import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

/**
 * Roaring OAuth client_credentials flow.
 *
 * Sätt som Supabase secrets (INTE Vercel VITE_-vars — secret stannar server-side):
 *   ROARING_CLIENT_ID
 *   ROARING_CLIENT_SECRET
 *
 * Endpoint-mönster verifierat från https://developer.roaring.io/docs/guides/authentication
 * och se-* API-katalogen på developer.roaring.io/docs/apis.
 *
 * Spurt A (2026-06-04): overview + board members + signing combinations parallellt.
 */

// In-memory token-cache (lever så länge edge function-instansen lever, vilket är minutsbar i Supabase)
let cachedToken: { value: string; expiresAt: number } | null = null

async function getRoaringToken(clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.value
  }

  const basic = btoa(`${clientId}:${clientSecret}`)
  const response = await fetch('https://api.roaring.io/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new Error(`Roaring OAuth token error: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  cachedToken = {
    value: data.access_token,
    expiresAt: now + (data.expires_in * 1000) - 60_000, // marginal 60s
  }
  return data.access_token
}

async function callRoaring<T>(token: string, path: string): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const response = await fetch(`https://api.roaring.io${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const text = await response.text()
      return { ok: false, status: response.status, error: text }
    }
    return { ok: true, status: response.status, data: await response.json() as T }
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) }
  }
}

// Klassificera firmateckning till strukturerad regel för avtalsmotorn.
// OBS: Roaring returnerar klausulen UTAN mellanslag ("...tvåiförening...") — matcha därför
// whitespace-okänsligt genom att strippa all whitespace från både text och mönster.
function classifySignatory(rawDescription?: string): 'individually' | 'jointly_two' | 'jointly_three' | 'jointly_all' | 'other' {
  if (!rawDescription) return 'other'
  const t = rawDescription.toLowerCase().replace(/\s+/g, '')
  if (t.includes('varförsig') || t.includes('varochen')) return 'individually'
  if (t.includes('tvåiförening')) return 'jointly_two'
  if (t.includes('treiförening')) return 'jointly_three'
  if (t.includes('iförening') && (t.includes('alla') || t.includes('samtliga'))) return 'jointly_all'
  return 'other'
}

// Roaring namnformat: "Efternamn, Förnamn Mellannamn" -> "Förnamn Mellannamn Efternamn"
function formatPersonName(raw?: string): string {
  if (!raw) return ''
  const [last, first] = raw.split(',').map((s) => s.trim())
  return first ? `${first} ${last}` : last
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { orgNumber } = await req.json()

    if (!orgNumber) {
      return new Response(
        JSON.stringify({ error: 'orgNumber required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validera format: XXXXXX-XXXX eller XXXXXXXXXX
    const cleaned = orgNumber.replace('-', '')
    if (!/^\d{10}$/.test(cleaned)) {
      return new Response(
        JSON.stringify({ error: 'Invalid org number format. Expected XXXXXX-XXXX' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const formatted = `${cleaned.substring(0, 6)}-${cleaned.substring(6)}`
    const clientId = Deno.env.get('ROARING_CLIENT_ID')
    const clientSecret = Deno.env.get('ROARING_CLIENT_SECRET')

    // Fallback: rikare mock-data när credentials saknas
    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          orgNumber: cleaned,
          source: 'mock',
          message: 'ROARING_CLIENT_ID / ROARING_CLIENT_SECRET not configured — returning mock data',
          data: {
            name: `Testbolag ${cleaned} AB`,
            orgNumber: cleaned,
            registrationDate: '2024-01-15',
            address: 'Storgatan 1, 111 22 Stockholm',
            sede: 'Stockholm',
            sniCode: '62010',
            sniDescription: 'Dataprogrammering',
            companyType: 'Aktiebolag',
            status: 'Aktivt',
            numberOfEmployees: 5,
            shareCapital: 50000,
            boardMembers: [
              { name: 'Anna Andersson', role: 'Styrelseordförande' },
              { name: 'Bertil Bengtsson', role: 'Styrelseledamot' },
              { name: 'Cecilia Carlsson', role: 'Styrelseledamot' },
            ],
            signatory: {
              description: 'Firman tecknas av styrelsen. Firman tecknas två i förening av styrelsens ledamöter.',
              rule: 'jointly_two',
              authorizedPersons: ['Anna Andersson', 'Bertil Bengtsson', 'Cecilia Carlsson'],
            },
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // OAuth-token (cached)
    const token = await getRoaringToken(clientId, clientSecret)

    // Parallella API-anrop mot verifierade Roaring-endpoints (alla v2.0):
    //   overview             — företagsdata (records[0])
    //   board-members        — styrelse (ofta tom i sandbox; härleds då ur signing-combinations)
    //   signatory            — firmateckningsklausul (companySignatory, fritext)
    //   signing-combinations — strukturerade kombinationer (vilka som får teckna firman ihop)
    const [overviewRes, boardRes, signatoryRes, combinationsRes] = await Promise.all([
      callRoaring<unknown>(token, `/se/company/overview/2.0/${formatted}`),
      callRoaring<unknown>(token, `/se/company/board-members/2.0/${formatted}`),
      callRoaring<unknown>(token, `/se/company/signatory/2.0/${formatted}`),
      callRoaring<unknown>(token, `/se/company/signing-combinations/2.0/${formatted}`),
    ])

    if (!overviewRes.ok) {
      return new Response(
        JSON.stringify({
          error: `Roaring overview-anrop misslyckades`,
          status: overviewRes.status,
          details: overviewRes.error,
        }),
        { status: overviewRes.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Roaring lägger faktiska data i `records[]` och signalerar träff via `status.code` (0 = found, 1 = not found).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overviewBody = overviewRes.data as any
    const record = overviewBody?.records?.[0]

    if (!record || overviewBody?.status?.code !== 0) {
      // OBS: HTTP 200 (inte 404) — supabase.functions.invoke i frontend behandlar alla
      // icke-2xx-svar som fel och kastar bort bodyn. Signalera "ej hittad" via found:false.
      return new Response(
        JSON.stringify({
          orgNumber: cleaned,
          source: 'roaring',
          found: false,
          message: overviewBody?.status?.text || 'records not found',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const boardBody = boardRes.ok ? (boardRes.data as any) : null
    const signatoryBody = signatoryRes.ok ? (signatoryRes.data as any) : null
    const combinationsBody = combinationsRes.ok ? (combinationsRes.data as any) : null
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // Roaring datumformat: "YYYYMMDD" -> "YYYY-MM-DD"
    const fmtDate = (d?: string): string | undefined =>
      d && /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d

    // Hela adressraden: "Box 213, 10124 STOCKHOLM"
    const fullAddress = [record.address, [record.zipCode, record.town].filter(Boolean).join(' ')]
      .filter(Boolean).join(', ') || undefined

    // Firmateckningskombinationer: records[0].combinations = array av grupper,
    // där varje grupp är personerna som TILLSAMMANS får teckna firman.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawCombos: any[][] = combinationsBody?.records?.[0]?.combinations ?? []
    const combinations = rawCombos.map((group) =>
      group.map((p) => ({
        name: formatPersonName(p.name),
        personalNumber: p.personalNumber,
        roles: (p.positions ?? []).map((pos: { roleName?: string }) => pos.roleName).filter(Boolean),
      }))
    )

    // Slå ihop till unika personer (per personnummer) för authorizedPersons + härledd styrelse.
    const personByNr = new Map<string, { name: string; roles: string[] }>()
    for (const group of combinations) {
      for (const p of group) {
        const key = p.personalNumber || p.name
        const existing = personByNr.get(key)
        if (existing) {
          for (const r of p.roles) if (!existing.roles.includes(r)) existing.roles.push(r)
        } else {
          personByNr.set(key, { name: p.name, roles: [...p.roles] })
        }
      }
    }
    const authorizedPersons = [...personByNr.values()].map((p) => p.name)

    // Styrelse: använd board-members-endpointen om den har data, annars härled ur firmatecknarna.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boardRecords: any[] = boardBody?.records ?? []
    let boardMembers = boardRecords.map((m) => ({
      name: m.name ? formatPersonName(m.name) : [m.givenName || m.firstName, m.surName || m.lastName].filter(Boolean).join(' ').trim(),
      role: m.roleText || m.functionText || m.role || m.roleCode || '',
    })).filter((m) => m.name)
    let boardSource: 'roaring_board' | 'derived_from_signatory' = 'roaring_board'
    if (boardMembers.length === 0 && personByNr.size > 0) {
      boardMembers = [...personByNr.values()].map((p) => ({ name: p.name, role: p.roles.join(', ') }))
      boardSource = 'derived_from_signatory'
    }

    const signatoryClause = signatoryBody?.records?.[0]?.companySignatory
    const merged = {
      name: record.companyName,
      orgNumber: cleaned,
      registrationDate: fmtDate(record.companyRegistrationDate),
      address: fullAddress,
      sede: record.commune || record.town,
      sniCode: record.industryCode,
      sniDescription: record.industryText,
      companyType: record.legalGroupText,
      status: record.statusTextHigh || record.statusTextDetailed,
      // Roaring ger intervall ("1-4 anställda"), inte exakt antal — exponera råsträngen separat.
      numberOfEmployeesInterval: record.numberEmployeesInterval,
      boardMembers,
      boardSource,
      signatory: signatoryClause ? {
        description: signatoryClause,
        rule: classifySignatory(signatoryClause),
        authorizedPersons,
        combinations,
        raw: { signatory: signatoryBody, combinations: combinationsBody },
      } : undefined,
    }

    return new Response(
      JSON.stringify({
        orgNumber: cleaned,
        source: 'roaring',
        found: true,
        data: merged,
        endpoints: {
          overview: overviewRes.ok,
          boardMembers: boardRes.ok,
          signatory: signatoryRes.ok,
          signingCombinations: combinationsRes.ok,
        }
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
