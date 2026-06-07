import { useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { callEdgeFunction } from '@/lib/edge-functions'
import { hasTrustLevel } from '@/types/dashboard'
import {
  FileSignature, Users, Briefcase, Building2, ShieldCheck, AlertTriangle,
  Loader2, ArrowLeft, ArrowRight, Copy, CheckCircle2, Clock, Sparkles, Download,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Typer
// ---------------------------------------------------------------------------

type ContractType = 'nda' | 'employment'
type ViewState = 'select' | 'form' | 'loading' | 'result' | 'flagged' | 'error'

interface ReviewPoint {
  section: string
  note: string
}

interface GenerateResponse {
  contractId: string | null
  status?: string
  qaStatus?: string
  title?: string
  content_markdown?: string
  review_points?: ReviewPoint[]
  summary?: string
  // flaggat svar
  message?: string
  estimated_time?: string
}

// ---------------------------------------------------------------------------
// Formulärdata
// ---------------------------------------------------------------------------

interface NdaForm {
  avtalstyp: 'ensidigt' | 'omsesidigt'
  utgivareNamn: string
  utgivareOrgnr: string
  utgivareAdress: string
  mottagareNamn: string
  mottagareOrgnr: string
  mottagareAdress: string
  syfte: string
  informationstyp: string
  avtalstidAr: string
  viteAnvands: boolean
  viteBelopp: string
  tvistlosning: 'scc_forenklat' | 'domstol'
}

interface EmploymentForm {
  arbetstagareNamn: string
  befattning: string
  arbetsuppgifter: string
  tilltradesdag: string
  anstallningsform: 'tillsvidare' | 'provanstallning' | 'visstid'
  visstidSlutdatum: string
  manadslon: string
  semesterdagar: string
  arbetstid: string
  arbetsplats: string
  kollektivavtal: boolean
  tjanstepension: boolean
  konkurrensklausul: boolean
}

const NDA_STEPS = [
  { label: 'Parter', icon: Building2 },
  { label: 'Informationen', icon: ShieldCheck },
  { label: 'Villkor', icon: Briefcase },
]

const EMP_STEPS = [
  { label: 'Arbetstagare & roll', icon: Users },
  { label: 'Villkor', icon: Briefcase },
  { label: 'Övrigt', icon: ShieldCheck },
]

// ---------------------------------------------------------------------------
// Minimal markdown-rendering (rubriker, fetstil, stycken) — ingen extern dep
// ---------------------------------------------------------------------------

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
      : <span key={`${keyPrefix}-${i}`}>{part}</span>
  )
}

function MarkdownView({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => markdown.split(/\n{2,}/), [markdown])
  return (
    <div className="space-y-3">
      {blocks.map((block, bi) => {
        const trimmed = block.trim()
        if (!trimmed) return null
        if (trimmed.startsWith('## ')) {
          return <h2 key={bi} className="text-xl font-bold text-[#0E3047] text-center pt-2">{trimmed.slice(3)}</h2>
        }
        if (trimmed.startsWith('### ')) {
          return <h3 key={bi} className="text-base font-semibold text-[#0E3047] pt-3">{renderInline(trimmed.slice(4), `h-${bi}`)}</h3>
        }
        if (/^[-*] /m.test(trimmed)) {
          const items = trimmed.split('\n').filter((l) => /^[-*] /.test(l.trim()))
          return (
            <ul key={bi} className="list-disc pl-5 space-y-1 text-sm text-[#2D3436] leading-relaxed">
              {items.map((item, ii) => <li key={ii}>{renderInline(item.trim().slice(2), `li-${bi}-${ii}`)}</li>)}
            </ul>
          )
        }
        return (
          <p key={bi} className="text-sm text-[#2D3436] leading-relaxed whitespace-pre-line">
            {renderInline(trimmed, `p-${bi}`)}
          </p>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Småkomponenter (samma visuella språk som HealthCheck)
// ---------------------------------------------------------------------------

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-[#0E3047]' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  )
}

function InputField({ label, value, onChange, placeholder, type = 'text', hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#0E3047] mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-[#E8E4DE] text-sm text-[#0E3047] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0E3047]/20"
      />
      {hint && <p className="text-xs text-[#4B6680] mt-1">{hint}</p>}
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#0E3047] mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 rounded-lg border border-[#E8E4DE] text-sm text-[#0E3047] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0E3047]/20"
      />
      {hint && <p className="text-xs text-[#4B6680] mt-1">{hint}</p>}
    </div>
  )
}

function Toggle({ label, value, onChange, hint }: {
  label: string; value: boolean; onChange: (v: boolean) => void; hint?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <p className="text-sm font-medium text-[#0E3047]">{label}</p>
        {hint && <p className="text-xs text-[#4B6680] mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-[#0E3047]' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

function ChoiceRow<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string; hint?: string }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#0E3047] mb-2">{label}</label>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`text-left rounded-lg border p-3 transition-all ${
              value === opt.value ? 'border-[#0E3047] ring-1 ring-[#0E3047]/20 bg-[#FAF6EE]/50' : 'border-[#E8E4DE] hover:border-[#0E3047]/40'
            }`}
          >
            <p className="text-sm font-medium text-[#0E3047]">{opt.label}</p>
            {opt.hint && <p className="text-xs text-[#4B6680] mt-0.5">{opt.hint}</p>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Huvudkomponent
// ---------------------------------------------------------------------------

export function ContractEngine() {
  const { user, profile, trustLevel, signInWithBankID, activeCompany } = useAuth()
  const isBankId = hasTrustLevel(trustLevel, 'bankid')

  const firstCompany = profile?.engagements?.items?.[0]
  // Aktivt bolag (valt i "Dina bolag") har företräde — fallback till första engagemanget
  const ownCompanyName = activeCompany?.name ?? firstCompany?.companyName ?? ''
  const ownCompanyOrgnr = activeCompany?.orgNumber ?? firstCompany?.orgNumber ?? ''

  const [view, setView] = useState<ViewState>('select')
  const [contractType, setContractType] = useState<ContractType>('nda')
  const [step, setStep] = useState(0)
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [nda, setNda] = useState<NdaForm>({
    avtalstyp: 'ensidigt',
    utgivareNamn: ownCompanyName,
    utgivareOrgnr: ownCompanyOrgnr,
    utgivareAdress: activeCompany?.address ?? '',
    mottagareNamn: '',
    mottagareOrgnr: '',
    mottagareAdress: '',
    syfte: '',
    informationstyp: '',
    avtalstidAr: '3',
    viteAnvands: false,
    viteBelopp: '',
    tvistlosning: 'scc_forenklat',
  })

  const [emp, setEmp] = useState<EmploymentForm>({
    arbetstagareNamn: '',
    befattning: '',
    arbetsuppgifter: '',
    tilltradesdag: '',
    anstallningsform: 'tillsvidare',
    visstidSlutdatum: '',
    manadslon: '',
    semesterdagar: '25',
    arbetstid: 'Heltid',
    arbetsplats: '',
    kollektivavtal: false,
    tjanstepension: false,
    konkurrensklausul: false,
  })

  const steps = contractType === 'nda' ? NDA_STEPS : EMP_STEPS

  const updateNda = <K extends keyof NdaForm>(key: K, value: NdaForm[K]) => setNda((f) => ({ ...f, [key]: value }))
  const updateEmp = <K extends keyof EmploymentForm>(key: K, value: EmploymentForm[K]) => setEmp((f) => ({ ...f, [key]: value }))

  const handleGenerate = async () => {
    setView('loading')
    setErrorMessage('')
    try {
      const formAnswers = contractType === 'nda'
        ? {
            avtalstyp: nda.avtalstyp,
            utgivare: { namn: nda.utgivareNamn, orgnr: nda.utgivareOrgnr, adress: nda.utgivareAdress },
            mottagare: { namn: nda.mottagareNamn, orgnr: nda.mottagareOrgnr, adress: nda.mottagareAdress },
            syfte: nda.syfte,
            informationstyp: nda.informationstyp,
            avtalstid_ar: Number(nda.avtalstidAr) || 3,
            vite: { anvands: nda.viteAnvands, belopp_kr: nda.viteAnvands ? Number(nda.viteBelopp) || null : null },
            varvningsforbud: false,
            tvistlosning: nda.tvistlosning,
          }
        : {
            arbetstagare: { namn: emp.arbetstagareNamn },
            befattning: emp.befattning,
            arbetsuppgifter: emp.arbetsuppgifter,
            tilltradesdag: emp.tilltradesdag,
            anstallningsform: emp.anstallningsform,
            ...(emp.anstallningsform === 'visstid' && { visstid_slutdatum: emp.visstidSlutdatum }),
            manadslon_kr: Number(emp.manadslon) || null,
            semesterdagar: Number(emp.semesterdagar) || 25,
            arbetstid: emp.arbetstid,
            arbetsplats: emp.arbetsplats,
            kollektivavtal: emp.kollektivavtal,
            tjanstepension: emp.tjanstepension,
            konkurrensklausul: emp.konkurrensklausul,
          }

      const response = await callEdgeFunction<GenerateResponse>('generate-contract', {
        contractType,
        formAnswers,
        companyData: contractType === 'nda'
          ? (activeCompany ?? { name: nda.utgivareNamn, orgNumber: nda.utgivareOrgnr })
          : (activeCompany ?? { name: ownCompanyName, orgNumber: ownCompanyOrgnr }),
        trustLevel,
        userId: user?.id || profile?.id || null,
        orgNumber: contractType === 'nda' ? nda.utgivareOrgnr : ownCompanyOrgnr || null,
        companyName: contractType === 'nda' ? nda.utgivareNamn : ownCompanyName || null,
      })

      setResult(response)
      setView(response.status === 'generated' && response.content_markdown ? 'result' : 'flagged')
    } catch (err) {
      console.error('generate-contract failed:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Ett oväntat fel uppstod')
      setView('error')
    }
  }

  const handleCopy = async () => {
    if (!result?.content_markdown) return
    await navigator.clipboard.writeText(result.content_markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportPdf = async () => {
    if (!result?.contractId) return
    setExporting(true)
    setExportError(null)
    try {
      const response = await callEdgeFunction<{ avtalUrl: string; instruktionerUrl: string }>('export-contract-pdf', {
        contractId: result.contractId,
        userId: user?.id || profile?.id || null,
      })
      // Öppna båda dokumenten: avtalet (rent, UTKAST-stämplat) + ASTRA-instruktionerna
      window.open(response.avtalUrl, '_blank', 'noopener')
      setTimeout(() => window.open(response.instruktionerUrl, '_blank', 'noopener'), 300)
    } catch (err) {
      console.error('export-contract-pdf failed:', err)
      setExportError(err instanceof Error ? err.message : 'PDF-exporten misslyckades')
    } finally {
      setExporting(false)
    }
  }

  const reset = () => {
    setView('select')
    setStep(0)
    setResult(null)
    setErrorMessage('')
  }

  // -------------------------------------------------------------------------
  // Trust-gate: BankID krävs (LockedOverlay-principen — visa vägen framåt)
  // -------------------------------------------------------------------------
  if (!isBankId) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight text-[#0E3047] mb-6">Avtalsmotorn</h1>
        <div className="bg-[#F5F5F0] rounded-xl p-8 text-center">
          <FileSignature size={40} className="text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#0E3047] mb-2">Lås upp med BankID</h2>
          <p className="text-sm text-[#4B6680] mb-6 max-w-md mx-auto">
            Avtal genereras med Johns perspektiv bakom analysen och kräver därför att du
            verifierar dig med BankID. Det tar mindre än en minut.
          </p>
          <button
            onClick={() => signInWithBankID()}
            className="bg-[#0E3047] text-[#FAF6EE] px-6 py-3 rounded-lg font-medium hover:bg-[#1A4060] transition-colors"
          >
            Verifiera med BankID
          </button>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // VAL AV AVTALSTYP
  // -------------------------------------------------------------------------
  if (view === 'select') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#0E3047]">Avtalsmotorn</h1>
          <p className="text-gray-500 mt-1">
            Skapa ett skräddarsytt avtalsutkast på ett par minuter. Granskat av AI-kvalitetskontroll
            innan leverans.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            {
              type: 'nda' as const,
              icon: ShieldCheck,
              title: 'Sekretessavtal (NDA)',
              desc: 'Skydda känslig information inför förhandlingar, due diligence eller samarbeten.',
            },
            {
              type: 'employment' as const,
              icon: Users,
              title: 'Anställningsavtal',
              desc: 'Komplett anställningsavtal enligt LAS — tillsvidare, provanställning eller visstid.',
            },
          ]).map((card) => (
            <button
              key={card.type}
              onClick={() => { setContractType(card.type); setStep(0); setView('form') }}
              className="text-left bg-white rounded-xl border border-[#E8E4DE] p-6 hover:border-[#0E3047]/40 hover:shadow-sm transition-all relative overflow-hidden"
            >
              <div className="absolute left-0 top-0 right-0 h-[3px] bg-[#B5453B]" />
              <card.icon size={24} className="text-[#B5453B] mb-3" />
              <h3 className="font-semibold text-[#0E3047] mb-1">{card.title}</h3>
              <p className="text-sm text-[#4B6680]">{card.desc}</p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-[#B5453B] mt-3">
                Skapa <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // LOADING
  // -------------------------------------------------------------------------
  if (view === 'loading') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <Loader2 size={36} className="animate-spin text-[#0E3047] mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#0E3047] mb-2">Ditt avtal upprättas</h2>
          <p className="text-sm text-[#4B6680] max-w-sm mx-auto">
            Utkastet genereras och kvalitetsgranskas innan det levereras. Det tar normalt under en minut.
          </p>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // FLAGGAT — manuell granskning
  // -------------------------------------------------------------------------
  if (view === 'flagged') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <Clock size={36} className="text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#0E3047] mb-2">Kvalitetskontroll pågår</h2>
          <p className="text-sm text-[#4B6680] max-w-md mx-auto mb-2">
            {result?.message ?? 'Ditt avtal genomgår kvalitetskontroll innan det levereras. Du får det inom kort.'}
          </p>
          {result?.estimated_time && (
            <p className="text-xs text-gray-400 mb-6">Beräknad tid: {result.estimated_time}</p>
          )}
          <button
            onClick={reset}
            className="bg-[#0E3047] text-[#FAF6EE] px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1A4060] transition-colors"
          >
            Tillbaka till avtalsmotorn
          </button>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // FEL
  // -------------------------------------------------------------------------
  if (view === 'error') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <AlertTriangle size={36} className="text-[#B5453B] mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#0E3047] mb-2">Något gick fel</h2>
          <p className="text-sm text-[#4B6680] max-w-md mx-auto mb-6">{errorMessage}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setView('form')} className="bg-[#0E3047] text-[#FAF6EE] px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1A4060] transition-colors">
              Försök igen
            </button>
            <button onClick={reset} className="text-sm text-[#4B6680] hover:text-[#0E3047] transition-colors">
              Börja om
            </button>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // RESULTAT
  // -------------------------------------------------------------------------
  if (view === 'result' && result) {
    const reviewPoints = result.review_points ?? []
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0E3047]">{result.title}</h1>
            {result.summary && <p className="text-gray-500 mt-1 text-sm">{result.summary}</p>}
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={exporting || !result.contractId}
              className="flex items-center gap-1.5 bg-[#B5453B] text-[#FAF6EE] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9E3B32] transition-colors disabled:opacity-50"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {exporting ? 'Skapar PDF...' : 'Ladda ner PDF'}
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 bg-[#0E3047] text-[#FAF6EE] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1A4060] transition-colors"
            >
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {copied ? 'Kopierat' : 'Kopiera'}
            </button>
          </div>
        </div>

        {exportError && (
          <div className="flex items-start gap-2 text-xs text-[#B5453B] bg-[#B5453B]/5 border border-[#B5453B]/20 rounded-lg p-3">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{exportError}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
          <Sparkles size={14} />
          <span>Utkastet har genererats och passerat AI-kvalitetskontroll{result.qaStatus === 'corrected' ? ' (med korrigeringar)' : ''}.</span>
        </div>

        {reviewPoints.length > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-amber-600" />
              <h3 className="font-semibold text-[#0E3047] text-sm">Granska innan användning ({reviewPoints.length})</h3>
            </div>
            <ul className="space-y-2.5">
              {reviewPoints.map((rp, i) => (
                <li key={i} className="text-sm text-[#2D3436]">
                  <span className="font-medium text-[#0E3047]">{rp.section}:</span> {rp.note}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
          <MarkdownView markdown={result.content_markdown ?? ''} />
        </div>

        <p className="text-xs text-gray-400 text-center max-w-lg mx-auto">
          Detta är ett grunddokument framtaget med Johns perspektiv. Granska punkterna ovan och
          anpassa avtalet till din situation innan det används. PDF-nedladdningen innehåller två
          dokument: avtalet (UTKAST-märkt) och ett instruktionsdokument från ASTRA ADVOKATER med
          användningsguide och viktig information.
        </p>

        <div className="flex items-center justify-center gap-3 pb-4">
          <button onClick={reset} className="text-sm text-[#4B6680] hover:text-[#0E3047] transition-colors">
            Skapa ett nytt avtal
          </button>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // FORMULÄR (wizard)
  // -------------------------------------------------------------------------
  const StepIcon = steps[step].icon
  const isLastStep = step === steps.length - 1

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[#0E3047]">
          {contractType === 'nda' ? 'Sekretessavtal (NDA)' : 'Anställningsavtal'}
        </h1>
        <p className="text-gray-500 mt-1">Svara på frågorna så upprättas avtalet utifrån dina förutsättningar.</p>
      </div>

      <ProgressBar step={step} total={steps.length} />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <StepIcon size={20} className="text-[#0E3047]" />
          <h2 className="text-lg font-semibold text-[#0E3047]">{steps[step].label}</h2>
        </div>

        <div className="space-y-4">
          {/* ============ NDA ============ */}
          {contractType === 'nda' && step === 0 && (
            <>
              <ChoiceRow
                label="Vem lämnar information?"
                value={nda.avtalstyp}
                onChange={(v) => updateNda('avtalstyp', v)}
                options={[
                  { value: 'ensidigt', label: 'Bara vi lämnar', hint: 'Ensidigt — motparten tar emot' },
                  { value: 'omsesidigt', label: 'Båda parter', hint: 'Ömsesidigt — symmetriska skyldigheter' },
                ]}
              />
              <InputField label="Ditt bolag" value={nda.utgivareNamn} onChange={(v) => updateNda('utgivareNamn', v)} placeholder="AB Företaget" />
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Org.nr" value={nda.utgivareOrgnr} onChange={(v) => updateNda('utgivareOrgnr', v)} placeholder="XXXXXX-XXXX" />
                <InputField label="Adress" value={nda.utgivareAdress} onChange={(v) => updateNda('utgivareAdress', v)} placeholder="Gata, postnr, ort" />
              </div>
              <InputField label="Motpart" value={nda.mottagareNamn} onChange={(v) => updateNda('mottagareNamn', v)} placeholder="Motpartens firmanamn" />
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Motpartens org.nr" value={nda.mottagareOrgnr} onChange={(v) => updateNda('mottagareOrgnr', v)} placeholder="XXXXXX-XXXX" />
                <InputField label="Motpartens adress" value={nda.mottagareAdress} onChange={(v) => updateNda('mottagareAdress', v)} placeholder="Gata, postnr, ort" />
              </div>
            </>
          )}
          {contractType === 'nda' && step === 1 && (
            <>
              <TextArea
                label="Vad är syftet med informationsutbytet?"
                value={nda.syfte}
                onChange={(v) => updateNda('syfte', v)}
                placeholder="T.ex. motparten överväger att investera i bolaget och ska genomföra en due diligence-granskning..."
                hint="Var konkret — syftet styr vad informationen får användas till."
              />
              <InputField
                label="Vilken typ av information lämnas?"
                value={nda.informationstyp}
                onChange={(v) => updateNda('informationstyp', v)}
                placeholder="T.ex. finansiell information, teknisk dokumentation, kundlistor"
                hint="Finansiell information behöver normalt 2-3 års skydd, teknisk 5 år eller mer."
              />
              <InputField
                label="Avtalstid (år)"
                value={nda.avtalstidAr}
                onChange={(v) => updateNda('avtalstidAr', v)}
                type="number"
                placeholder="3"
              />
            </>
          )}
          {contractType === 'nda' && step === 2 && (
            <>
              <Toggle
                label="Vite vid överträdelse"
                value={nda.viteAnvands}
                onChange={(v) => updateNda('viteAnvands', v)}
                hint="Ett förbestämt belopp per överträdelse. Viktigaste funktionen är preventiv."
              />
              {nda.viteAnvands && (
                <InputField label="Vitesbelopp (kr)" value={nda.viteBelopp} onChange={(v) => updateNda('viteBelopp', v)} type="number" placeholder="250000" />
              )}
              <ChoiceRow
                label="Tvistlösning"
                value={nda.tvistlosning}
                onChange={(v) => updateNda('tvistlosning', v)}
                options={[
                  { value: 'scc_forenklat', label: 'Skiljeförfarande (SCC)', hint: 'Snabbt och konfidentiellt — standard för NDA' },
                  { value: 'domstol', label: 'Allmän domstol', hint: 'Offentligt men lägre kostnad' },
                ]}
              />
            </>
          )}

          {/* ============ ANSTÄLLNING ============ */}
          {contractType === 'employment' && step === 0 && (
            <>
              <InputField label="Arbetstagarens namn" value={emp.arbetstagareNamn} onChange={(v) => updateEmp('arbetstagareNamn', v)} placeholder="Förnamn Efternamn" />
              <InputField label="Befattning" value={emp.befattning} onChange={(v) => updateEmp('befattning', v)} placeholder="T.ex. Utvecklingschef" />
              <TextArea label="Huvudsakliga arbetsuppgifter" value={emp.arbetsuppgifter} onChange={(v) => updateEmp('arbetsuppgifter', v)} placeholder="Beskriv rollen kort" />
              <InputField label="Tillträdesdag" value={emp.tilltradesdag} onChange={(v) => updateEmp('tilltradesdag', v)} type="date" />
            </>
          )}
          {contractType === 'employment' && step === 1 && (
            <>
              <ChoiceRow
                label="Anställningsform"
                value={emp.anstallningsform}
                onChange={(v) => updateEmp('anstallningsform', v)}
                options={[
                  { value: 'tillsvidare', label: 'Tillsvidare', hint: 'Huvudregeln — "fast anställning"' },
                  { value: 'provanstallning', label: 'Provanställning', hint: 'Max 6 månader enligt LAS' },
                  { value: 'visstid', label: 'Särskild visstid', hint: 'Tidsbegränsad enligt 5 § LAS' },
                ]}
              />
              {emp.anstallningsform === 'visstid' && (
                <InputField label="Slutdatum" value={emp.visstidSlutdatum} onChange={(v) => updateEmp('visstidSlutdatum', v)} type="date" />
              )}
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Månadslön (kr)" value={emp.manadslon} onChange={(v) => updateEmp('manadslon', v)} type="number" placeholder="45000" />
                <InputField label="Semesterdagar" value={emp.semesterdagar} onChange={(v) => updateEmp('semesterdagar', v)} type="number" hint="Minst 25 enligt semesterlagen" />
              </div>
              <InputField label="Arbetstid" value={emp.arbetstid} onChange={(v) => updateEmp('arbetstid', v)} placeholder="T.ex. Heltid, förtroendearbetstid" />
              <InputField label="Arbetsplats" value={emp.arbetsplats} onChange={(v) => updateEmp('arbetsplats', v)} placeholder="T.ex. kontoret i Göteborg, distans 2 dagar/vecka" />
            </>
          )}
          {contractType === 'employment' && step === 2 && (
            <>
              <Toggle label="Bundet av kollektivavtal" value={emp.kollektivavtal} onChange={(v) => updateEmp('kollektivavtal', v)} />
              <Toggle label="Tjänstepension erbjuds" value={emp.tjanstepension} onChange={(v) => updateEmp('tjanstepension', v)} hint="Utan kollektivavtal är detta frivilligt men starkt rekommenderat." />
              <Toggle label="Konkurrensklausul" value={emp.konkurrensklausul} onChange={(v) => updateEmp('konkurrensklausul', v)} hint="Används restriktivt — måste vara skälig och kompenserad (38 § avtalslagen)." />
            </>
          )}
        </div>

        {/* Navigering */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-[#E8E4DE]/60">
          <button
            onClick={() => (step === 0 ? reset() : setStep((s) => s - 1))}
            className="flex items-center gap-1.5 text-sm text-[#4B6680] hover:text-[#0E3047] transition-colors"
          >
            <ArrowLeft size={14} />
            {step === 0 ? 'Avbryt' : 'Tillbaka'}
          </button>
          {isLastStep ? (
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1.5 bg-[#B5453B] text-[#FAF6EE] px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9E3B32] transition-colors"
            >
              <FileSignature size={14} />
              Upprätta avtalet
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1.5 bg-[#0E3047] text-[#FAF6EE] px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1A4060] transition-colors"
            >
              Nästa
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
