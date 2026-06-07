import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from 'https://esm.sh/pdf-lib@1.17.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

/**
 * export-contract-pdf (Spurt C, 2026-06-07)
 *
 * Tar contractId → genererar TVÅ PDF:er och returnerar signerade URL:er (1 h):
 *
 *   1. AVTALET — rent och neutralt: ingen byrå-branding, UTKAST-vattenstämpel
 *      på varje sida. Avtalet är parternas dokument, inte byråns.
 *
 *   2. INSTRUKTIONSDOKUMENTET — ASTRA ADVOKATER-header. Beskriver syftet med
 *      avtalet, hur det används på bästa sätt, punkter att granska, samt
 *      friskrivning: användningen bör åtföljas av rådgivning för korrekt
 *      tillämpning och anpassning.
 *
 * Lagras i privat bucket 'contract-exports' — endast service role, klienten
 * får tidsbegränsade signerade URL:er.
 */

// ---------------------------------------------------------------------------
// Designkonstanter (maritim palett)
// ---------------------------------------------------------------------------
const NAVY = rgb(0x1f / 255, 0x45 / 255, 0x67 / 255)      // harbour navy #1F4567
const BRASS = rgb(0xc1 / 255, 0x8b / 255, 0x2a / 255)     // mässing #C18B2A
const INK = rgb(0x2d / 255, 0x34 / 255, 0x36 / 255)       // text #2D3436
const GRAY = rgb(0.45, 0.45, 0.45)
const WATERMARK_GRAY = rgb(0.82, 0.82, 0.82)

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 70
const CONTENT_WIDTH = A4[0] - MARGIN * 2

// ---------------------------------------------------------------------------
// Texthantering
// ---------------------------------------------------------------------------

// WinAnsi (cp1252) täcker åäö, ”’–— m.m. Ersätt tecken utanför.
function sanitizeWinAnsi(text: string): string {
  return text
    .replace(/\s+/g, ' ') // radbrytningar/tabbar → mellanslag (wrapText sköter radbyten)
    .replace(/[‘’‚]/g, '’')
    .replace(/[“”„]/g, '”')
    .replace(/–/g, '–')
    .replace(/—/g, '—')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    // Allt som inte ryms i Latin-1/cp1252-ish → '?'
    .replace(/[^\x20-\x7E¡-ÿ‘’“”–—•]/g, '?')
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate
    } else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.length > 0 ? lines : ['']
}

// Markdown → block-lista (## / ### / punktlista / stycke). Inline ** strippas.
type Block =
  | { kind: 'title'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'para'; text: string }

function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = []
  for (const raw of md.split(/\n{2,}/)) {
    const chunk = raw.trim()
    if (!chunk) continue
    // Rubrik-chunks kan innehålla brödtext på efterföljande rader (singel-\n
    // överlever split på \n{2,}) — bara första raden är rubriken.
    if (chunk.startsWith('## ')) {
      const [first, ...rest] = chunk.split('\n')
      blocks.push({ kind: 'title', text: first.slice(3).replace(/\*\*/g, '') })
      const remainder = rest.join(' ').trim()
      if (remainder) blocks.push({ kind: 'para', text: remainder.replace(/\*\*/g, '') })
      continue
    }
    if (chunk.startsWith('### ')) {
      const [first, ...rest] = chunk.split('\n')
      blocks.push({ kind: 'heading', text: first.slice(4).replace(/\*\*/g, '') })
      const remainder = rest.join(' ').trim()
      if (remainder) blocks.push({ kind: 'para', text: remainder.replace(/\*\*/g, '') })
      continue
    }
    const lines = chunk.split('\n')
    if (lines.every((l) => /^[-*] /.test(l.trim()) || l.trim() === '')) {
      for (const l of lines) {
        const t = l.trim()
        if (t) blocks.push({ kind: 'bullet', text: t.slice(2).replace(/\*\*/g, '') })
      }
      continue
    }
    blocks.push({ kind: 'para', text: chunk.replace(/\*\*/g, '').replace(/\n/g, ' ') })
  }
  return blocks
}

// ---------------------------------------------------------------------------
// Layoutmotor
// ---------------------------------------------------------------------------

interface Writer {
  doc: PDFDocument
  page: PDFPage
  y: number
  decoratePage: (page: PDFPage) => void
}

function newPage(w: Writer): void {
  w.page = w.doc.addPage(A4)
  w.decoratePage(w.page)
  w.y = A4[1] - MARGIN
}

function ensureSpace(w: Writer, needed: number): void {
  if (w.y - needed < MARGIN + 30) newPage(w)
}

function writeLines(
  w: Writer,
  text: string,
  font: PDFFont,
  size: number,
  opts: { color?: ReturnType<typeof rgb>; lineGap?: number; indent?: number; align?: 'left' | 'center' } = {}
): void {
  const { color = INK, lineGap = 4, indent = 0, align = 'left' } = opts
  const lines = wrapText(sanitizeWinAnsi(text), font, size, CONTENT_WIDTH - indent)
  for (const line of lines) {
    ensureSpace(w, size + lineGap)
    const x = align === 'center'
      ? MARGIN + (CONTENT_WIDTH - font.widthOfTextAtSize(line, size)) / 2
      : MARGIN + indent
    w.page.drawText(line, { x, y: w.y - size, size, font, color })
    w.y -= size + lineGap
  }
}

function space(w: Writer, amount: number): void {
  w.y -= amount
}

// ---------------------------------------------------------------------------
// Dekoratörer
// ---------------------------------------------------------------------------

function watermarkDecorator(fontBold: PDFFont) {
  return (page: PDFPage) => {
    page.drawText('UTKAST', {
      x: 120,
      y: 230,
      size: 110,
      font: fontBold,
      color: WATERMARK_GRAY,
      rotate: degrees(45),
      opacity: 0.35,
    })
  }
}

function astraHeaderDecorator(fontBold: PDFFont, font: PDFFont) {
  return (page: PDFPage) => {
    // Wordmark + mässingslinje — texten är headern (SVG-logon kan inte bäddas in direkt)
    page.drawText('ASTRA ADVOKATER', {
      x: MARGIN,
      y: A4[1] - 50,
      size: 13,
      font: fontBold,
      color: NAVY,
    })
    page.drawLine({
      start: { x: MARGIN, y: A4[1] - 58 },
      end: { x: A4[0] - MARGIN, y: A4[1] - 58 },
      thickness: 1.2,
      color: BRASS,
    })
    // Sidfot
    page.drawText('ASTRA ADVOKATER  ·  Advokat John Tengström  ·  johntengstrom.se', {
      x: MARGIN,
      y: 40,
      size: 8,
      font,
      color: GRAY,
    })
  }
}

// ---------------------------------------------------------------------------
// Dokumentbyggare
// ---------------------------------------------------------------------------

async function buildContractPdf(title: string, markdown: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const times = await doc.embedFont(StandardFonts.TimesRoman)
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const w: Writer = { doc, page: undefined as unknown as PDFPage, y: 0, decoratePage: watermarkDecorator(helvBold) }
  newPage(w)
  space(w, 10)

  const blocks = parseMarkdown(markdown)
  // Om markdownen saknar huvudrubrik: använd title
  if (!blocks.some((b) => b.kind === 'title')) {
    writeLines(w, title, timesBold, 16, { align: 'center' })
    space(w, 14)
  }

  for (const block of blocks) {
    switch (block.kind) {
      case 'title':
        writeLines(w, block.text, timesBold, 16, { align: 'center' })
        space(w, 14)
        break
      case 'heading':
        ensureSpace(w, 40)
        space(w, 8)
        writeLines(w, block.text, timesBold, 12)
        space(w, 2)
        break
      case 'bullet':
        writeLines(w, `•  ${block.text}`, times, 10.5, { indent: 12, lineGap: 3 })
        space(w, 2)
        break
      case 'para':
        writeLines(w, block.text, times, 10.5, { lineGap: 4 })
        space(w, 6)
        break
    }
  }

  return doc.save()
}

interface ReviewPoint {
  section?: string
  note?: string
}

const NDA_USAGE = [
  'Kontrollera att parternas uppgifter (firmanamn, organisationsnummer, adress) är fullständiga och korrekta. Uppgifter inom klamrar [ ] måste alltid fyllas i.',
  'Stäm av att syftesbeskrivningen i Bakgrund stämmer med den faktiska processen — syftet styr vad motparten får använda informationen till.',
  'Ta ställning till avtalstiden utifrån informationens karaktär: finansiell information behöver normalt 2-3 års skydd, teknisk information 5 år eller mer.',
  'Gå igenom avtalet med motparten innan undertecknande. En genomgång ger sekretessåtagandet en starkare preventiv verkan.',
  'Underteckna med behörig firmatecknare för respektive part. Kontrollera firmateckningsregeln för ditt bolag under Dina bolag i Grundat.',
]

const EMPLOYMENT_USAGE = [
  'Fyll i samtliga uppgifter inom klamrar [ ], särskilt arbetstagarens personnummer och adress samt lönens utbetalningsdag.',
  'Kontrollera lön, förmåner och semestervillkor mot vad som faktiskt överenskommits vid rekryteringen.',
  'Saknar bolaget kollektivavtal: ta aktivt ställning till tjänstepension och försäkringar — det är ofta avgörande för att attrahera och behålla medarbetare.',
  'Se till att avtalet är undertecknat av båda parter före tillträdesdagen. Arbetsgivarens skriftliga information om anställningsvillkoren är ett lagkrav (6 c § LAS).',
  'Spara det undertecknade avtalet i bolagets dokumentarkiv tillsammans med eventuella bilagor.',
]

const FRISKRIVNING =
  'Detta avtalsutkast har tagits fram digitalt via Grundat utifrån de uppgifter som lämnats av användaren. ' +
  'Dokumentet är ett grunddokument som måste granskas och anpassas till omständigheterna i det enskilda fallet innan det används. ' +
  'Användningen av avtalet bör åtföljas av rådgivning för att säkerställa korrekt tillämpning och anpassning. ' +
  'Dokumentet utgör inte juridisk rådgivning, och något klientförhållande till ASTRA ADVOKATER uppstår inte genom att dokumentet tas fram eller används. ' +
  'För rådgivning och anpassning till din situation, boka ett samtal via johntengstrom.se/boka.'

async function buildInstructionPdf(input: {
  title: string
  contractType: 'nda' | 'employment'
  summary: string | null
  reviewPoints: ReviewPoint[]
  companyName: string | null
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const w: Writer = { doc, page: undefined as unknown as PDFPage, y: 0, decoratePage: astraHeaderDecorator(helvBold, helv) }
  newPage(w)
  space(w, 30) // plats under headern

  const typeLabel = input.contractType === 'nda' ? 'sekretessavtal' : 'anställningsavtal'
  const dateStr = new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })

  writeLines(w, 'INSTRUKTIONER OCH VIKTIG INFORMATION', helvBold, 15, { color: NAVY })
  space(w, 2)
  writeLines(w, input.title, helv, 11, { color: GRAY })
  writeLines(w, dateStr, helv, 9, { color: GRAY })
  space(w, 16)

  // Om dokumentet
  writeLines(w, 'Om dokumentet', helvBold, 12, { color: NAVY })
  space(w, 4)
  const intro = input.summary
    ? input.summary
    : `Detta ${typeLabel} har tagits fram via Grundat${input.companyName ? ` för ${input.companyName}` : ''} utifrån de uppgifter som lämnats.`
  writeLines(w, intro, helv, 10, { lineGap: 4 })
  space(w, 14)

  // Så använder du avtalet
  writeLines(w, 'Så använder du avtalet på bästa sätt', helvBold, 12, { color: NAVY })
  space(w, 4)
  const usage = input.contractType === 'nda' ? NDA_USAGE : EMPLOYMENT_USAGE
  usage.forEach((item, i) => {
    writeLines(w, `${i + 1}.  ${item}`, helv, 10, { indent: 6, lineGap: 4 })
    space(w, 4)
  })
  space(w, 10)

  // Punkter att granska (från AI-genereringen)
  if (input.reviewPoints.length > 0) {
    writeLines(w, 'Punkter att granska i just ditt avtal', helvBold, 12, { color: NAVY })
    space(w, 4)
    for (const rp of input.reviewPoints) {
      const text = rp.section ? `${rp.section}: ${rp.note ?? ''}` : (rp.note ?? '')
      if (!text.trim()) continue
      writeLines(w, `•  ${text}`, helv, 10, { indent: 6, lineGap: 4 })
      space(w, 4)
    }
    space(w, 10)
  }

  // Friskrivning — alltid sist, alltid med
  ensureSpace(w, 130)
  writeLines(w, 'Viktig information', helvBold, 12, { color: NAVY })
  space(w, 4)
  writeLines(w, FRISKRIVNING, helv, 9.5, { lineGap: 4, color: INK })

  return doc.save()
}

// ---------------------------------------------------------------------------
// HTTP-handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { contractId, userId } = await req.json()

    if (!contractId) {
      return new Response(
        JSON.stringify({ error: 'contractId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const admin = getAdminClient()
    const { data: contract, error: fetchError } = await admin
      .from('contracts')
      .select('id, user_id, title, contract_type, content_markdown, review_points, summary, company_name, status')
      .eq('id', contractId)
      .single()

    if (fetchError || !contract) {
      return new Response(
        JSON.stringify({ error: 'Avtalet hittades inte' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ägarkontroll när avtalet är knutet till en användare
    if (contract.user_id && contract.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Åtkomst nekad' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!contract.content_markdown || contract.status === 'flagged') {
      return new Response(
        JSON.stringify({ error: 'Avtalet är under kvalitetsgranskning och kan inte exporteras ännu' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const title = contract.title || (contract.contract_type === 'nda' ? 'Sekretessavtal' : 'Anställningsavtal')
    const reviewPoints: ReviewPoint[] = Array.isArray(contract.review_points) ? contract.review_points : []

    const [contractPdf, instructionPdf] = await Promise.all([
      buildContractPdf(title, contract.content_markdown),
      buildInstructionPdf({
        title,
        contractType: contract.contract_type,
        summary: contract.summary,
        reviewPoints,
        companyName: contract.company_name,
      }),
    ])

    // Ladda upp till privat bucket och skapa signerade URL:er (1 h)
    const basePath = `${contract.id}`
    const uploads: { name: string; path: string; bytes: Uint8Array }[] = [
      { name: 'avtal', path: `${basePath}/avtal.pdf`, bytes: contractPdf },
      { name: 'instruktioner', path: `${basePath}/instruktioner.pdf`, bytes: instructionPdf },
    ]

    const urls: Record<string, string> = {}
    for (const u of uploads) {
      const { error: uploadError } = await admin.storage
        .from('contract-exports')
        .upload(u.path, u.bytes, { contentType: 'application/pdf', upsert: true })
      if (uploadError) throw new Error(`Upload misslyckades (${u.name}): ${uploadError.message}`)

      const { data: signed, error: signError } = await admin.storage
        .from('contract-exports')
        .createSignedUrl(u.path, 3600)
      if (signError || !signed?.signedUrl) throw new Error(`Signerad URL misslyckades (${u.name})`)
      urls[u.name] = signed.signedUrl
    }

    return new Response(
      JSON.stringify({
        contractId: contract.id,
        avtalUrl: urls['avtal'],
        instruktionerUrl: urls['instruktioner'],
        expiresInSeconds: 3600,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
