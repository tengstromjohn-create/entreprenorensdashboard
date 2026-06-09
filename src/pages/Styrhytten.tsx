import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanyOverview } from '@/hooks/useCompanyOverview'
import { CompanyZone } from '@/components/dashboard/CompanyZone'
import { HUB_NAME, HUB_TAGLINE } from '@/lib/brand'
import {
  HeartPulse, FileSignature, ListChecks, FolderOpen, Scale, ArrowRight,
  Lock, ChevronRight,
} from 'lucide-react'

const SCORE_COLORS: Record<string, string> = { green: '#16A34A', yellow: '#EAB308', red: '#DC2626' }
const CONTRACT_LABELS: Record<string, string> = { nda: 'Sekretessavtal', employment: 'Anställningsavtal' }

function SectionHeader({ icon: Icon, title, action }: { icon: typeof HeartPulse; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon size={17} className="text-[#0E3047]" />
        <h2 className="font-semibold text-[#0E3047]">{title}</h2>
      </div>
      {action}
    </div>
  )
}

export function Styrhytten() {
  const navigate = useNavigate()
  const { user, profile, activeCompany } = useAuth()
  const userId = user?.id || profile?.id
  const { overview, loading } = useCompanyOverview(userId, activeCompany?.orgNumber)

  const hc = overview?.latestHealthCheck ?? null
  const contracts = overview?.contracts ?? []
  const todos = hc?.analysis?.top_3_actions ?? []

  return (
    <div className="space-y-8">
      {/* Sidhuvud med byggrits-signaturlinje */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0E3047]">{HUB_NAME}</h1>
        <div className="mt-2 flex items-center gap-2" aria-hidden="true">
          <span className="h-[3px] w-12 bg-[#B5453B] rounded-sm" />
          <span className="h-[3px] w-1 bg-[#B5453B] rounded-sm" />
          <span className="h-[3px] w-3 bg-[#B5453B]/50 rounded-sm" />
        </div>
        <p className="text-[#4B6680] mt-3 text-sm">{HUB_TAGLINE}.</p>
      </div>

      {/* 1. Dina bolag + bolagsdata (befintlig vy) */}
      <CompanyZone />

      {/* 2. Senaste Health Check */}
      <section>
        <SectionHeader
          icon={HeartPulse}
          title="Senaste Health Check"
          action={
            hc ? (
              <button onClick={() => navigate('/dashboard/verktyg/health-check')} className="text-sm text-[#0E3047] hover:underline flex items-center gap-1">
                Kör ny <ArrowRight size={13} />
              </button>
            ) : null
          }
        />
        {hc ? (
          <button
            onClick={() => navigate('/dashboard/verktyg/health-check')}
            className="w-full text-left bg-white rounded-xl border border-[#E8E4DE] p-5 hover:border-[#0E3047]/40 transition-colors"
          >
            <div className="flex items-center gap-5">
              <div className="flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: `${SCORE_COLORS[hc.analysis?.total_color ?? 'yellow']}15` }}>
                <span className="text-2xl font-bold" style={{ color: SCORE_COLORS[hc.analysis?.total_color ?? 'yellow'] }}>{hc.score}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {(hc.analysis?.areas ?? []).map((a) => (
                    <span key={a.name} className="flex items-center gap-1.5 text-xs text-[#4B6680]">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SCORE_COLORS[a.color] }} />
                      {a.name} {a.score}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Analys {new Date(hc.created_at).toLocaleDateString('sv-SE')}
                  {hc.review_status === 'lawyer_reviewed' && ' · juristgranskad'}
                </p>
              </div>
              <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
            </div>
          </button>
        ) : (
          <div className="bg-[#F5F5F0] rounded-xl p-6 text-center">
            <p className="text-sm text-[#4B6680] mb-3">{loading ? 'Hämtar...' : 'Du har inte kört Health Check ännu.'}</p>
            {!loading && (
              <button onClick={() => navigate('/dashboard/verktyg/health-check')} className="bg-[#0E3047] text-[#FAF6EE] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1A4060] transition-colors">
                Kör din första Health Check
              </button>
            )}
          </div>
        )}
      </section>

      {/* 3. Att göra (härledd ur Health Checks top-3) */}
      {todos.length > 0 && (
        <section>
          <SectionHeader icon={ListChecks} title="Att göra" />
          <div className="bg-white rounded-xl border border-[#E8E4DE] divide-y divide-[#E8E4DE]/70">
            {todos.map((t, i) => (
              <div key={i} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 w-5 h-5 rounded-full border-2 border-[#B5453B]/40 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#0E3047]">{t.action}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.area}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Genererade avtal */}
      <section>
        <SectionHeader
          icon={FileSignature}
          title="Genererade avtal"
          action={
            <button onClick={() => navigate('/dashboard/verktyg/avtal')} className="text-sm text-[#0E3047] hover:underline flex items-center gap-1">
              Skapa nytt <ArrowRight size={13} />
            </button>
          }
        />
        {contracts.length > 0 ? (
          <div className="bg-white rounded-xl border border-[#E8E4DE] divide-y divide-[#E8E4DE]/70">
            {contracts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-4">
                <div className="bg-[#F5F5F0] rounded-lg p-2 flex-shrink-0">
                  <FileSignature size={16} className="text-[#B5453B]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0E3047] truncate">{c.title || CONTRACT_LABELS[c.contract_type]}</p>
                  <p className="text-xs text-gray-400">
                    {CONTRACT_LABELS[c.contract_type]} · {new Date(c.created_at).toLocaleDateString('sv-SE')}
                    {c.status === 'flagged' && ' · under granskning'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#F5F5F0] rounded-xl p-6 text-center">
            <p className="text-sm text-[#4B6680]">Inga avtal skapade ännu.</p>
          </div>
        )}
      </section>

      {/* 5. Dokumentarkiv (avtal med exporterbar PDF) */}
      <section>
        <SectionHeader icon={FolderOpen} title="Dokumentarkiv" />
        <div className="bg-[#F5F5F0] rounded-xl p-6 text-center">
          <p className="text-sm text-[#4B6680]">
            {contracts.length > 0
              ? `${contracts.length} dokument. Öppna ett avtal i Avtalsmotorn för att ladda ner som PDF.`
              : 'Dina genererade dokument samlas här. Skapa ett avtal eller kör en Health Check för att börja.'}
          </p>
        </div>
      </section>

      {/* 6. Regulatoriska krav — platshållare (Legal Source Genie fyller senare) */}
      <section>
        <SectionHeader icon={Scale} title="Regulatoriska krav" />
        <div className="bg-white rounded-xl border border-dashed border-[#E8E4DE] p-6 relative overflow-hidden">
          <div className="absolute left-0 top-0 right-0 h-[3px] bg-[#C18B2A]" />
          <div className="flex items-start gap-3">
            <div className="bg-[#C18B2A]/10 rounded-lg p-2 flex-shrink-0">
              <Lock size={16} className="text-[#C18B2A]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#0E3047]">Kartläggning av tillstånd och regelkrav — kommer snart</p>
              <p className="text-sm text-[#4B6680] mt-1">
                Här samlas de tillstånd, registreringar och regulatoriska krav som gäller just din verksamhet,
                baserat på din bransch och Health Check-svar.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
