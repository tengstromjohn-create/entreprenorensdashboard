import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanyData } from '@/hooks/useCompanyData'
import { useHealthCheck } from '@/hooks/useHealthCheck'
import { callEdgeFunction } from '@/lib/edge-functions'
import { hasTrustLevel } from '@/types/dashboard'
import { UpgradeModal } from '@/components/shared/UpgradeModal'
import {
  HEALTH_CHECK_STEPS,
  REQUIRED_QUESTION_IDS,
  labelForAnswer,
  type HealthCheckStep,
} from '@/lib/healthCheckQuestions'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Scale,
  Coins,
  Users,
  FileSignature,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Lock,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Database,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalysisArea {
  name: string
  score: number
  color: 'green' | 'yellow' | 'red'
  key_findings: string[]
  recommendations: {
    title: string
    description: string
    priority: 'critical' | 'important' | 'nice_to_have'
    consequence_if_skipped: string
  }[]
  johns_perspective: string | null
}

interface AnalysisResult {
  company_name: string
  org_number: string
  analysis_date: string
  trust_level: 'bankid' | 'org_only'
  total_score: number
  total_color: 'green' | 'yellow' | 'red'
  areas: AnalysisArea[]
  top_3_actions: { action: string; area: string; link_to_tool: string | null }[]
  upgrade_cta: string | null
}

type ViewState = 'form' | 'loading' | 'results' | 'error'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEP_ICONS = { Building2, Scale, FileSignature, Users, Coins }

const SCORE_COLORS = {
  green: '#16A34A',
  yellow: '#EAB308',
  red: '#DC2626',
}

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  critical: { label: 'Kritiskt', color: 'text-red-600 bg-red-50' },
  important: { label: 'Viktigt', color: 'text-amber-600 bg-amber-50' },
  nice_to_have: { label: 'Bra att ha', color: 'text-blue-600 bg-blue-50' },
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex-1 flex items-center gap-2">
          <div
            className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
              i < step ? 'bg-[#0E3047]' : i === step ? 'bg-[#0E3047]/60' : 'bg-gray-200'
            }`}
          />
        </div>
      ))}
      <span className="text-xs text-gray-400 ml-1 whitespace-nowrap">
        {step + 1}/{total}
      </span>
    </div>
  )
}

function RadioField({
  label,
  help,
  value,
  onChange,
  options,
}: {
  label: string
  help?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#0E3047] mb-1">{label}</label>
      {help && <p className="text-xs text-[#4B6680] mb-2">{help}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const selected = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`flex items-center gap-2.5 text-left rounded-lg border px-3 py-2.5 text-sm transition-all ${
                selected
                  ? 'border-[#0E3047] ring-1 ring-[#0E3047]/20 bg-[#FAF6EE]/60 text-[#0E3047]'
                  : 'border-gray-200 hover:border-[#0E3047]/40 text-gray-700'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  selected ? 'border-[#0E3047]' : 'border-gray-300'
                }`}
              >
                {selected && <span className="w-2 h-2 rounded-full bg-[#0E3047]" />}
              </span>
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TextAreaField({
  label,
  help,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string
  help?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#0E3047] mb-1">{label}</label>
      {help && <p className="text-xs text-[#4B6680] mb-2">{help}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#0E3047] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0E3047]/20 focus:border-[#0E3047] resize-none"
      />
    </div>
  )
}

function ScoreCircle({ score, color, size = 'lg' }: { score: number; color: string; size?: 'lg' | 'sm' }) {
  const r = size === 'lg' ? 54 : 28
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference
  const viewBox = size === 'lg' ? '0 0 128 128' : '0 0 68 68'
  const cx = size === 'lg' ? 64 : 34
  const sw = size === 'lg' ? 10 : 5

  return (
    <div className={`relative ${size === 'lg' ? 'w-32 h-32' : 'w-[68px] h-[68px]'} flex-shrink-0`}>
      <svg className="-rotate-90 w-full h-full" viewBox={viewBox}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#F3F4F6" strokeWidth={sw} />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-bold text-[#0E3047] ${size === 'lg' ? 'text-3xl' : 'text-base'}`}>{score}</span>
      </div>
    </div>
  )
}

function AreaCard({
  area,
  isBankId,
  onUpgrade,
}: {
  area: AnalysisArea
  isBankId: boolean
  onUpgrade: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const color = SCORE_COLORS[area.color]
  const StatusIcon = area.color === 'green' ? CheckCircle2 : area.color === 'yellow' ? AlertTriangle : XCircle

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50/50 transition-colors"
      >
        <ScoreCircle score={area.score} color={color} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <StatusIcon size={16} style={{ color }} />
            <h3 className="font-semibold text-[#0E3047]">{area.name}</h3>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{area.key_findings[0]}</p>
        </div>
        {expanded ? (
          <ChevronUp size={18} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Observationer</h4>
            <ul className="space-y-1.5">
              {area.key_findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {area.recommendations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Rekommendationer</h4>
              <div className="space-y-2">
                {area.recommendations.map((rec, i) => {
                  const pri = PRIORITY_LABELS[rec.priority] || PRIORITY_LABELS.nice_to_have
                  return (
                    <div key={i} className="rounded-lg bg-[#FAFAF8] p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pri.color}`}>{pri.label}</span>
                        <span className="text-sm font-medium text-[#0E3047]">{rec.title}</span>
                      </div>
                      <p className="text-sm text-gray-600">{rec.description}</p>
                      {rec.consequence_if_skipped && (
                        <p className="text-xs text-gray-400 mt-1 italic">Om du hoppar över: {rec.consequence_if_skipped}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {isBankId && area.johns_perspective ? (
            <div className="rounded-lg bg-green-50 border border-green-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-green-600" />
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">Johns perspektiv</span>
              </div>
              <p className="text-sm text-green-800 leading-relaxed">{area.johns_perspective}</p>
            </div>
          ) : !isBankId ? (
            <button
              onClick={onUpgrade}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <Lock size={14} />
              Verifiera med BankID för Johns personliga perspektiv
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

// Autohämtad bolagsdata — visas, frågas inte
function AutoDataPanel({ company }: { company: Record<string, unknown> | null }) {
  if (!company) return null
  const rows: { label: string; value?: string }[] = [
    { label: 'Bolagsnamn', value: company.name as string },
    { label: 'Org.nr', value: company.orgNumber as string },
    { label: 'Bolagsform', value: company.companyType as string },
    { label: 'Status', value: company.status as string },
    { label: 'Säte', value: company.sede as string },
    { label: 'Registrerat', value: company.registrationDate as string },
  ].filter((r) => r.value)

  // deno-irrelevant
  const board = (company.boardMembers as { name: string; role: string }[] | undefined) ?? []
  const signatory = company.signatory as { description?: string } | undefined

  return (
    <div className="rounded-lg bg-[#F5F5F0] border border-[#E8E4DE] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Database size={15} className="text-[#0E3047]" />
        <h3 className="text-sm font-semibold text-[#0E3047]">Hämtat automatiskt från Bolagsverket</h3>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col">
            <span className="text-[11px] text-gray-400">{r.label}</span>
            <span className="text-sm text-[#0E3047]">{r.value}</span>
          </div>
        ))}
      </div>
      {board.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#E8E4DE]/70">
          <span className="text-[11px] text-gray-400">Styrelse</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {board.map((m, i) => (
              <span key={i} className="text-xs bg-white text-[#0E3047] px-2 py-0.5 rounded-full border border-[#E8E4DE]">
                {m.name}{m.role ? ` · ${m.role}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      {signatory?.description && (
        <div className="mt-3 pt-3 border-t border-[#E8E4DE]/70">
          <span className="text-[11px] text-gray-400">Firmateckning</span>
          <p className="text-xs text-[#4B6680] mt-1">{signatory.description}</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const STEPS: HealthCheckStep[] = HEALTH_CHECK_STEPS

export function HealthCheck() {
  const navigate = useNavigate()
  const { user, profile, trustLevel, signInWithBankID, activeCompany } = useAuth()
  const { companyData, fetchFromProfile } = useCompanyData(user?.id)
  // BankID-användare saknar Supabase-session — bolaget kan inte läsas från user_profiles.
  // activeCompany (valt i "Dina bolag") är då källan. DB-läsningen har företräde om den finns.
  const effectiveCompany = companyData ?? activeCompany ?? null

  const { refresh: refreshHealthCheck } = useHealthCheck(user?.id)

  const [view, setView] = useState<ViewState>('form')
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [orgFallback, setOrgFallback] = useState({ orgNumber: '', companyName: '' })
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)

  const isBankId = hasTrustLevel(trustLevel, 'bankid')

  useEffect(() => {
    if (user?.id) fetchFromProfile()
  }, [user?.id, fetchFromProfile])

  const orgNumber = effectiveCompany?.orgNumber || orgFallback.orgNumber
  const companyName = effectiveCompany?.name || orgFallback.companyName

  const setAnswer = (id: string, value: string) => setAnswers((prev) => ({ ...prev, [id]: value }))

  const currentStep = STEPS[step]

  const canAdvance = (): boolean => {
    // Steg 0 kräver org-nummer (autohämtat eller manuellt)
    if (step === 0 && !orgNumber.trim()) return false
    return currentStep.questions
      .filter((q) => REQUIRED_QUESTION_IDS.has(q.id))
      .every((q) => !!answers[q.id])
  }

  const handleSubmit = async () => {
    setView('loading')
    setErrorMessage('')

    try {
      // Bygg en läsbar svarslista (område + fråga + svar) för analysprompten
      const readable = STEPS.flatMap((s) =>
        s.questions
          .filter((q) => answers[q.id])
          .map((q) => ({
            area: q.area,
            question: q.label,
            answer: labelForAnswer(q.id, answers[q.id]),
          }))
      )

      const response = await callEdgeFunction<{ analysis: AnalysisResult }>('generate-health-check', {
        orgNumber,
        companyData: effectiveCompany || { name: companyName, orgNumber },
        surveyAnswers: answers,
        surveyReadable: readable,
        trustLevel: isBankId ? 'bankid' : 'org_only',
        userId: user?.id || profile?.id || undefined,
      })

      if (response.analysis) {
        setResult(response.analysis)
        setView('results')
        refreshHealthCheck()
      } else {
        throw new Error('Inget analysresultat returnerades')
      }
    } catch (err) {
      console.error('Health check failed:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Ett oväntat fel uppstod')
      setView('error')
    }
  }

  const handleRunAgain = () => {
    setView('form')
    setStep(0)
    setResult(null)
    setErrorMessage('')
  }

  // ---------------------------------------------------------------------------
  // FORM VIEW
  // ---------------------------------------------------------------------------

  if (view === 'form') {
    const Icon = STEP_ICONS[currentStep.icon]
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#0E3047]">Corporate Health Check</h1>
          <p className="text-gray-500 mt-1">Analysera ditt bolags juridiska status och riskbild.</p>
        </div>

        <ProgressBar step={step} total={STEPS.length} />

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <Icon size={20} className="text-[#0E3047]" />
            <h2 className="text-lg font-semibold text-[#0E3047]">{currentStep.label}</h2>
          </div>

          <div className="space-y-5">
            {/* Steg 0: autohämtad bolagsdata + ev. manuell org-input om data saknas */}
            {step === 0 && (
              effectiveCompany ? (
                <AutoDataPanel company={effectiveCompany as unknown as Record<string, unknown>} />
              ) : (
                <div className="space-y-3 rounded-lg bg-amber-50 border border-amber-100 p-4">
                  <p className="text-sm text-amber-800">
                    Inget bolag valt. Välj ett bolag under "Dina bolag" eller ange organisationsnummer här.
                  </p>
                  <input
                    type="text"
                    value={orgFallback.orgNumber}
                    onChange={(e) => setOrgFallback((p) => ({ ...p, orgNumber: e.target.value }))}
                    placeholder="Organisationsnummer (XXXXXX-XXXX)"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  />
                  <input
                    type="text"
                    value={orgFallback.companyName}
                    onChange={(e) => setOrgFallback((p) => ({ ...p, companyName: e.target.value }))}
                    placeholder="Bolagsnamn"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  />
                </div>
              )
            )}

            {currentStep.intro && <p className="text-sm text-[#4B6680]">{currentStep.intro}</p>}

            {currentStep.questions.map((q) =>
              q.type === 'radio' && q.options ? (
                <RadioField
                  key={q.id}
                  label={q.label + (REQUIRED_QUESTION_IDS.has(q.id) ? '' : ' (valfritt)')}
                  help={q.help}
                  value={answers[q.id] || ''}
                  onChange={(v) => setAnswer(q.id, v)}
                  options={q.options}
                />
              ) : (
                <TextAreaField
                  key={q.id}
                  label={q.label + (REQUIRED_QUESTION_IDS.has(q.id) ? '' : ' (valfritt)')}
                  help={q.help}
                  value={answers[q.id] || ''}
                  onChange={(v) => setAnswer(q.id, v)}
                  placeholder={q.placeholder}
                />
              )
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100">
            <button
              onClick={() => (step > 0 ? setStep(step - 1) : navigate('/dashboard/verktyg'))}
              className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#0E3047] transition-colors"
            >
              <ArrowLeft size={16} />
              {step > 0 ? 'Tillbaka' : 'Verktyg'}
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance()}
                className="flex items-center gap-2 bg-[#0E3047] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1A4060] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Nästa
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canAdvance()}
                className="flex items-center gap-2 bg-[#0E3047] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1A4060] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles size={16} />
                Kör analys
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // LOADING VIEW
  // ---------------------------------------------------------------------------

  if (view === 'loading') {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[400px] gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-[#F5F5F0] flex items-center justify-center">
            <Loader2 size={32} className="text-[#0E3047] animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[#0E3047] mb-2">Analyserar ditt bolag...</h2>
          <p className="text-sm text-gray-500">Vi granskar bolagsdata och dina svar med AI-driven juridisk expertis.</p>
          <p className="text-xs text-gray-400 mt-2">Detta tar vanligtvis 10-20 sekunder.</p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // ERROR VIEW
  // ---------------------------------------------------------------------------

  if (view === 'error') {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[400px] gap-6">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
          <XCircle size={32} className="text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[#0E3047] mb-2">Något gick fel</h2>
          <p className="text-sm text-gray-500 max-w-md">{errorMessage}</p>
        </div>
        <button
          onClick={handleRunAgain}
          className="flex items-center gap-2 bg-[#0E3047] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1A4060] transition-colors"
        >
          <RotateCcw size={16} />
          Försök igen
        </button>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // RESULTS VIEW
  // ---------------------------------------------------------------------------

  if (view === 'results' && result) {
    const scoreColor = SCORE_COLORS[result.total_color]

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0E3047]">Analysresultat</h1>
            <p className="text-gray-500 mt-0.5">
              {result.company_name} &middot; {result.org_number} &middot;{' '}
              {new Date(result.analysis_date).toLocaleDateString('sv-SE')}
            </p>
          </div>
          <button
            onClick={handleRunAgain}
            className="flex items-center gap-2 bg-[#F5F5F0] text-[#0E3047] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#E8E4DE] transition-colors"
          >
            <RotateCcw size={14} />
            Kör igen
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-8">
            <ScoreCircle score={result.total_score} color={scoreColor} size="lg" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-[#0E3047] mb-3">Totalpoäng</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {result.areas.map((area) => (
                  <div key={area.name} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: SCORE_COLORS[area.color] }} />
                    <span className="text-sm text-gray-600 truncate">{area.name}</span>
                    <span className="text-sm font-medium text-[#0E3047] ml-auto">{area.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {result.top_3_actions && result.top_3_actions.length > 0 && (
          <div className="bg-[#0E3047] rounded-xl p-6 text-white">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Sparkles size={16} />
              Top 3 åtgärder
            </h3>
            <div className="space-y-3">
              {result.top_3_actions.map((action, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="bg-white/20 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{action.action}</p>
                    <p className="text-xs text-white/60 mt-0.5">{action.area}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {result.areas.map((area) => (
            <AreaCard key={area.name} area={area} isBankId={isBankId} onUpgrade={() => setShowUpgrade(true)} />
          ))}
        </div>

        {!isBankId && result.upgrade_cta && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
            <ShieldCheck size={32} className="text-green-600 mx-auto mb-3" />
            <h3 className="font-semibold text-[#0E3047] mb-2">Få fullständig analys</h3>
            <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">{result.upgrade_cta}</p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="bg-[#0E3047] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1A4060] transition-colors inline-flex items-center gap-2"
            >
              Verifiera med BankID
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        <UpgradeModal
          isOpen={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          onBankId={signInWithBankID}
          currentLevel={trustLevel}
        />
      </div>
    )
  }

  return null
}
