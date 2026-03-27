import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanyData } from '@/hooks/useCompanyData'
import { useHealthCheck } from '@/hooks/useHealthCheck'
import { callEdgeFunction } from '@/lib/edge-functions'
import { hasTrustLevel } from '@/types/dashboard'
import { UpgradeModal } from '@/components/shared/UpgradeModal'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Briefcase,
  Scale,
  Coins,
  Users,
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
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormData {
  // Step 1: Grundinfo
  orgNumber: string
  companyName: string
  // Step 2: Affärsmodell & marknad
  businessDescription: string
  targetMarket: string
  revenueModel: string
  competitiveAdvantage: string
  // Step 3: Juridik & struktur
  hasShareholderAgreement: string
  hasBoardRules: string
  articlesUpdated: string
  hasCeoInstruction: string
  // Step 4: Ekonomi & finansiering
  shareCapital: string
  financingStrategy: string
  ownershipStructure: string
  balanceSheetRisk: string
  // Step 5: Team & tillväxt
  employeeCount: string
  hasEmploymentContracts: string
  hasInsurance: string
  hasGdprPolicy: string
}

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

const STEPS = [
  { label: 'Grundinfo', icon: Building2 },
  { label: 'Affärsmodell', icon: Briefcase },
  { label: 'Juridik', icon: Scale },
  { label: 'Ekonomi', icon: Coins },
  { label: 'Team', icon: Users },
]

const INITIAL_FORM: FormData = {
  orgNumber: '',
  companyName: '',
  businessDescription: '',
  targetMarket: '',
  revenueModel: '',
  competitiveAdvantage: '',
  hasShareholderAgreement: '',
  hasBoardRules: '',
  articlesUpdated: '',
  hasCeoInstruction: '',
  shareCapital: '',
  financingStrategy: '',
  ownershipStructure: '',
  balanceSheetRisk: '',
  employeeCount: '',
  hasEmploymentContracts: '',
  hasInsurance: '',
  hasGdprPolicy: '',
}

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
              i < step ? 'bg-[#2D3436]' : i === step ? 'bg-[#2D3436]/60' : 'bg-gray-200'
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

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = 'Välj...',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#2D3436] mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#2D3436] focus:outline-none focus:ring-2 focus:ring-[#2D3436]/20 focus:border-[#2D3436]"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  rows?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#2D3436] mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#2D3436] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2D3436]/20 focus:border-[#2D3436] resize-none"
      />
    </div>
  )
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#2D3436] mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#2D3436] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2D3436]/20 focus:border-[#2D3436] disabled:bg-gray-50 disabled:text-gray-500"
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
        <span className={`font-bold text-[#2D3436] ${size === 'lg' ? 'text-3xl' : 'text-base'}`}>{score}</span>
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
            <h3 className="font-semibold text-[#2D3436]">{area.name}</h3>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 truncate">
            {area.key_findings[0]}
          </p>
        </div>
        {expanded ? (
          <ChevronUp size={18} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
          {/* Key findings */}
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

          {/* Recommendations */}
          {area.recommendations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Rekommendationer</h4>
              <div className="space-y-2">
                {area.recommendations.map((rec, i) => {
                  const pri = PRIORITY_LABELS[rec.priority] || PRIORITY_LABELS.nice_to_have
                  return (
                    <div key={i} className="rounded-lg bg-[#FAFAF8] p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pri.color}`}>
                          {pri.label}
                        </span>
                        <span className="text-sm font-medium text-[#2D3436]">{rec.title}</span>
                      </div>
                      <p className="text-sm text-gray-600">{rec.description}</p>
                      {rec.consequence_if_skipped && (
                        <p className="text-xs text-gray-400 mt-1 italic">
                          Om du hoppar över: {rec.consequence_if_skipped}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Johns perspective */}
          {isBankId && area.johns_perspective ? (
            <div className="rounded-lg bg-green-50 border border-green-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-green-600" />
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">
                  Johns perspektiv
                </span>
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

// ---------------------------------------------------------------------------
// YES/NO options
// ---------------------------------------------------------------------------

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Ja' },
  { value: 'no', label: 'Nej' },
  { value: 'unsure', label: 'Vet ej' },
]

const YES_NO_NA_OPTIONS = [
  { value: 'yes', label: 'Ja' },
  { value: 'no', label: 'Nej' },
  { value: 'na', label: 'Ej aktuellt' },
  { value: 'unsure', label: 'Vet ej' },
]

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function HealthCheck() {
  const navigate = useNavigate()
  const { user, profile, trustLevel, signInWithBankID } = useAuth()
  const { companyData, fetchFromProfile } = useCompanyData(user?.id)
  const { refresh: refreshHealthCheck } = useHealthCheck(user?.id)

  const [view, setView] = useState<ViewState>('form')
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)

  const isBankId = hasTrustLevel(trustLevel, 'bankid')

  // Auto-fill org number from profile
  useEffect(() => {
    if (user?.id) fetchFromProfile()
  }, [user?.id, fetchFromProfile])

  useEffect(() => {
    if (companyData) {
      setForm((prev) => ({
        ...prev,
        orgNumber: companyData.orgNumber || prev.orgNumber,
        companyName: companyData.name || prev.companyName,
      }))
    }
  }, [companyData])

  // Auto-fill from profile org_number
  useEffect(() => {
    if (profile?.org_number && !form.orgNumber) {
      setForm((prev) => ({ ...prev, orgNumber: profile.org_number! }))
    }
  }, [profile, form.orgNumber])

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const canAdvance = (): boolean => {
    switch (step) {
      case 0:
        return !!form.orgNumber.trim()
      case 1:
        return !!form.businessDescription.trim()
      case 2:
        return !!form.hasShareholderAgreement
      case 3:
        return !!form.shareCapital
      case 4:
        return !!form.employeeCount
      default:
        return true
    }
  }

  const handleSubmit = async () => {
    setView('loading')
    setErrorMessage('')

    try {
      const surveyAnswers = {
        businessDescription: form.businessDescription,
        targetMarket: form.targetMarket,
        revenueModel: form.revenueModel,
        competitiveAdvantage: form.competitiveAdvantage,
        hasShareholderAgreement: form.hasShareholderAgreement,
        hasBoardRules: form.hasBoardRules,
        articlesUpdated: form.articlesUpdated,
        hasCeoInstruction: form.hasCeoInstruction,
        shareCapital: form.shareCapital,
        financingStrategy: form.financingStrategy,
        ownershipStructure: form.ownershipStructure,
        balanceSheetRisk: form.balanceSheetRisk,
        employeeCount: form.employeeCount,
        hasEmploymentContracts: form.hasEmploymentContracts,
        hasInsurance: form.hasInsurance,
        hasGdprPolicy: form.hasGdprPolicy,
      }

      const response = await callEdgeFunction<{ analysis: AnalysisResult }>(
        'generate-health-check',
        {
          orgNumber: form.orgNumber,
          companyData: companyData || { name: form.companyName, orgNumber: form.orgNumber },
          surveyAnswers,
          trustLevel: isBankId ? 'bankid' : 'org_only',
          userId: user?.id,
        }
      )

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
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#2D3436]">Corporate Health Check</h1>
          <p className="text-gray-500 mt-1">
            Analysera ditt bolags juridiska och regulatoriska status.
          </p>
        </div>

        <ProgressBar step={step} total={STEPS.length} />

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          {/* Step header */}
          <div className="flex items-center gap-3 mb-6">
            {(() => {
              const Icon = STEPS[step].icon
              return <Icon size={20} className="text-[#2D3436]" />
            })()}
            <h2 className="text-lg font-semibold text-[#2D3436]">{STEPS[step].label}</h2>
          </div>

          {/* Step content */}
          <div className="space-y-4">
            {step === 0 && (
              <>
                <InputField
                  label="Organisationsnummer"
                  value={form.orgNumber}
                  onChange={(v) => updateField('orgNumber', v)}
                  placeholder="XXXXXX-XXXX"
                  disabled={!!companyData?.orgNumber}
                />
                <InputField
                  label="Bolagsnamn"
                  value={form.companyName}
                  onChange={(v) => updateField('companyName', v)}
                  placeholder="AB Företaget"
                  disabled={!!companyData?.name}
                />
                {companyData && (
                  <div className="rounded-lg bg-green-50 border border-green-100 p-3 flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 size={16} />
                    Bolagsdata hämtad automatiskt
                  </div>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <TextAreaField
                  label="Beskriv din verksamhet"
                  value={form.businessDescription}
                  onChange={(v) => updateField('businessDescription', v)}
                  placeholder="Vad gör bolaget? Vilken bransch? Hur länge har ni varit verksamma?"
                />
                <TextAreaField
                  label="Målmarknad och kunder"
                  value={form.targetMarket}
                  onChange={(v) => updateField('targetMarket', v)}
                  placeholder="Vilka är era kunder? B2B eller B2C? Geografi?"
                  rows={2}
                />
                <SelectField
                  label="Intäktsmodell"
                  value={form.revenueModel}
                  onChange={(v) => updateField('revenueModel', v)}
                  options={[
                    { value: 'subscription', label: 'Prenumeration/SaaS' },
                    { value: 'transaction', label: 'Transaktionsbaserad' },
                    { value: 'consulting', label: 'Konsulting/Tjänster' },
                    { value: 'product', label: 'Produktförsäljning' },
                    { value: 'marketplace', label: 'Marknadsplats/Provision' },
                    { value: 'mixed', label: 'Blandad modell' },
                    { value: 'pre_revenue', label: 'Ännu ingen intäkt' },
                  ]}
                />
                <TextAreaField
                  label="Konkurrensfördel"
                  value={form.competitiveAdvantage}
                  onChange={(v) => updateField('competitiveAdvantage', v)}
                  placeholder="Vad skiljer er från konkurrenterna?"
                  rows={2}
                />
              </>
            )}

            {step === 2 && (
              <>
                <SelectField
                  label="Finns aktieägaravtal?"
                  value={form.hasShareholderAgreement}
                  onChange={(v) => updateField('hasShareholderAgreement', v)}
                  options={YES_NO_OPTIONS}
                />
                <SelectField
                  label="Finns styrelsens arbetsordning?"
                  value={form.hasBoardRules}
                  onChange={(v) => updateField('hasBoardRules', v)}
                  options={YES_NO_OPTIONS}
                />
                <SelectField
                  label="Är bolagsordningen uppdaterad och anpassad?"
                  value={form.articlesUpdated}
                  onChange={(v) => updateField('articlesUpdated', v)}
                  options={YES_NO_OPTIONS}
                />
                <SelectField
                  label="Finns VD-instruktion?"
                  value={form.hasCeoInstruction}
                  onChange={(v) => updateField('hasCeoInstruction', v)}
                  options={YES_NO_NA_OPTIONS}
                />
              </>
            )}

            {step === 3 && (
              <>
                <SelectField
                  label="Aktiekapital"
                  value={form.shareCapital}
                  onChange={(v) => updateField('shareCapital', v)}
                  options={[
                    { value: '25000', label: '25 000 kr (minimum)' },
                    { value: '50000-100000', label: '50 000 - 100 000 kr' },
                    { value: '100000-500000', label: '100 000 - 500 000 kr' },
                    { value: '500000+', label: 'Över 500 000 kr' },
                  ]}
                />
                <TextAreaField
                  label="Finansieringsstrategi"
                  value={form.financingStrategy}
                  onChange={(v) => updateField('financingStrategy', v)}
                  placeholder="Hur finansieras bolaget? Externt kapital, bootstrapping, lån?"
                  rows={2}
                />
                <TextAreaField
                  label="Ägarstruktur"
                  value={form.ownershipStructure}
                  onChange={(v) => updateField('ownershipStructure', v)}
                  placeholder="Hur ser ägarstrukturen ut? Antal ägare, fördelning?"
                  rows={2}
                />
                <SelectField
                  label="Finns risk för kontrollbalansräkning?"
                  value={form.balanceSheetRisk}
                  onChange={(v) => updateField('balanceSheetRisk', v)}
                  options={YES_NO_OPTIONS}
                />
              </>
            )}

            {step === 4 && (
              <>
                <SelectField
                  label="Antal anställda"
                  value={form.employeeCount}
                  onChange={(v) => updateField('employeeCount', v)}
                  options={[
                    { value: '0', label: 'Inga anställda (enbart grundare)' },
                    { value: '1-5', label: '1-5 anställda' },
                    { value: '6-20', label: '6-20 anställda' },
                    { value: '20+', label: 'Fler än 20 anställda' },
                  ]}
                />
                <SelectField
                  label="Finns anställningsavtal för alla?"
                  value={form.hasEmploymentContracts}
                  onChange={(v) => updateField('hasEmploymentContracts', v)}
                  options={YES_NO_NA_OPTIONS}
                />
                <SelectField
                  label="Finns ansvarsförsäkring och styrelseansvarsförsäkring?"
                  value={form.hasInsurance}
                  onChange={(v) => updateField('hasInsurance', v)}
                  options={YES_NO_OPTIONS}
                />
                <SelectField
                  label="Finns GDPR-policy och personuppgiftsbiträdesavtal?"
                  value={form.hasGdprPolicy}
                  onChange={(v) => updateField('hasGdprPolicy', v)}
                  options={YES_NO_OPTIONS}
                />
              </>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#2D3436] transition-colors"
              >
                <ArrowLeft size={16} />
                Tillbaka
              </button>
            ) : (
              <button
                onClick={() => navigate('/dashboard/verktyg')}
                className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#2D3436] transition-colors"
              >
                <ArrowLeft size={16} />
                Verktyg
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance()}
                className="flex items-center gap-2 bg-[#2D3436] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#3d4446] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Nästa
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canAdvance()}
                className="flex items-center gap-2 bg-[#2D3436] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#3d4446] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
            <Loader2 size={32} className="text-[#2D3436] animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[#2D3436] mb-2">Analyserar ditt bolag...</h2>
          <p className="text-sm text-gray-500">
            Vi granskar bolagsdata och dina svar med AI-driven juridisk expertis.
          </p>
          <p className="text-xs text-gray-400 mt-2">Detta tar vanligtvis 8-15 sekunder.</p>
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
          <h2 className="text-xl font-semibold text-[#2D3436] mb-2">Något gick fel</h2>
          <p className="text-sm text-gray-500 max-w-md">{errorMessage}</p>
        </div>
        <button
          onClick={handleRunAgain}
          className="flex items-center gap-2 bg-[#2D3436] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#3d4446] transition-colors"
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#2D3436]">Analysresultat</h1>
            <p className="text-gray-500 mt-0.5">
              {result.company_name} &middot; {result.org_number} &middot;{' '}
              {new Date(result.analysis_date).toLocaleDateString('sv-SE')}
            </p>
          </div>
          <button
            onClick={handleRunAgain}
            className="flex items-center gap-2 bg-[#F5F5F0] text-[#2D3436] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#E8E4DE] transition-colors"
          >
            <RotateCcw size={14} />
            Kör igen
          </button>
        </div>

        {/* Score overview */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-8">
            <ScoreCircle score={result.total_score} color={scoreColor} size="lg" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-[#2D3436] mb-3">Totalpoäng</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {result.areas.map((area) => (
                  <div key={area.name} className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: SCORE_COLORS[area.color] }}
                    />
                    <span className="text-sm text-gray-600 truncate">{area.name}</span>
                    <span className="text-sm font-medium text-[#2D3436] ml-auto">{area.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top 3 actions */}
        {result.top_3_actions && result.top_3_actions.length > 0 && (
          <div className="bg-[#2D3436] rounded-xl p-6 text-white">
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

        {/* Area cards */}
        <div className="space-y-3">
          {result.areas.map((area) => (
            <AreaCard
              key={area.name}
              area={area}
              isBankId={isBankId}
              onUpgrade={() => setShowUpgrade(true)}
            />
          ))}
        </div>

        {/* Upgrade CTA for non-BankID users */}
        {!isBankId && result.upgrade_cta && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
            <ShieldCheck size={32} className="text-green-600 mx-auto mb-3" />
            <h3 className="font-semibold text-[#2D3436] mb-2">Få fullständig analys</h3>
            <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">{result.upgrade_cta}</p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="bg-[#2D3436] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#3d4446] transition-colors inline-flex items-center gap-2"
            >
              Verifiera med BankID
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Upgrade modal */}
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
