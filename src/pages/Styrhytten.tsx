import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanyOverview } from '@/hooks/useCompanyOverview'
import { CompanyZone } from '@/components/dashboard/CompanyZone'
import { TrustBadge } from '@/components/shared/TrustBadge'
import { HUB_NAME, HUB_TAGLINE } from '@/lib/brand'
import {
  HeartPulse, FileSignature, ListChecks, Scale, Lock, ChevronRight, FolderOpen,
} from 'lucide-react'

const SCORE_COLORS: Record<string, string> = { green: '#16A34A', yellow: '#EAB308', red: '#DC2626' }
const CONTRACT_LABELS: Record<string, string> = { nda: 'Sekretessavtal', employment: 'Anställningsavtal' }

function SidebarCard({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#E8E4DE] p-5 relative overflow-hidden">
      {accent && <div className="absolute left-0 top-0 right-0 h-[3px]" style={{ backgroundColor: accent }} />}
      {children}
    </div>
  )
}

function CardTitle({ icon: Icon, title, action, iconColor = '#0E3047' }: {
  icon: typeof HeartPulse; title: string; action?: React.ReactNode; iconColor?: string
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color: iconColor }} />
        <h2 className="font-semibold text-[#0E3047] text-sm">{title}</h2>
      </div>
      {action}
    </div>
  )
}

export function Styrhytten() {
  const navigate = useNavigate()
  const { user, profile, trustLevel, activeCompany } = useAuth()
  const userId = user?.id || profile?.id
  const { overview, loading } = useCompanyOverview(userId, activeCompany?.orgNumber)

  const hc = overview?.latestHealthCheck ?? null
  const contracts = overview?.contracts ?? []
  const todos = hc?.analysis?.top_3_actions ?? []

  return (
    <div className="space-y-8">
      {/* Sidhuvud */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0E3047]">{HUB_NAME}</h1>
          <div className="mt-2 flex items-center gap-2" aria-hidden="true">
            <span className="h-[3px] w-12 bg-[#B5453B] rounded-sm" />
            <span className="h-[3px] w-1 bg-[#B5453B] rounded-sm" />
            <span className="h-[3px] w-3 bg-[#B5453B]/50 rounded-sm" />
          </div>
          <p className="text-[#4B6680] mt-3 text-sm">{HUB_TAGLINE}.</p>
        </div>
        <TrustBadge level={trustLevel} size="sm" />
      </div>

      {/* Tvåkolumnslayout: huvudinnehåll (bolagsdata) + sidokolumn (status & åtgärder) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* HUVUDKOLUMN — bolagsval, bolagsinfo, firmateckning, styrelse */}
        <div className="lg:col-span-2">
          <CompanyZone />
        </div>

        {/* SIDOKOLUMN — status och åtgärder */}
        <aside className="lg:col-span-1 space-y-5 lg:sticky lg:top-6">
          {/* Health Check */}
          <SidebarCard accent="#0E3047">
            <CardTitle
              icon={HeartPulse}
              title="Health Check"
              action={hc ? (
                <button onClick={() => navigate('/dashboard/verktyg/health-check')} className="text-xs text-[#0E3047] hover:underline">Kör ny</button>
              ) : null}
            />
            {hc ? (
              <button onClick={() => navigate('/dashboard/verktyg/health-check')} className="w-full text-left">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: `${SCORE_COLORS[hc.analysis?.total_color ?? 'yellow']}15` }}>
                    <span className="text-xl font-bold" style={{ color: SCORE_COLORS[hc.analysis?.total_color ?? 'yellow'] }}>{hc.score}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">
                      {new Date(hc.created_at).toLocaleDateString('sv-SE')}
                      {hc.review_status === 'lawyer_reviewed' && ' · juristgranskad'}
                    </p>
                    <span className="text-xs text-[#0E3047] font-medium flex items-center gap-1 mt-0.5">Se hela analysen <ChevronRight size={12} /></span>
                  </div>
                </div>
                {(hc.analysis?.areas?.length ?? 0) > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {hc.analysis!.areas!.map((a) => (
                      <div key={a.name} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: SCORE_COLORS[a.color] }} />
                        <span className="text-xs text-[#4B6680] truncate flex-1">{a.name}</span>
                        <span className="text-xs font-medium text-[#0E3047]">{a.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            ) : (
              <div>
                <p className="text-sm text-[#4B6680] mb-3">{loading ? 'Hämtar...' : 'Ingen analys ännu.'}</p>
                {!loading && (
                  <button onClick={() => navigate('/dashboard/verktyg/health-check')} className="w-full bg-[#0E3047] text-[#FAF6EE] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1A4060] transition-colors">
                    Kör Health Check
                  </button>
                )}
              </div>
            )}
          </SidebarCard>

          {/* Att göra */}
          {todos.length > 0 && (
            <SidebarCard accent="#B5453B">
              <CardTitle icon={ListChecks} title="Att göra" iconColor="#B5453B" />
              <div className="space-y-2.5">
                {todos.map((t, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 w-4 h-4 rounded-full border-2 border-[#B5453B]/40 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-[#0E3047] leading-snug">{t.action}</p>
                      <p className="text-[11px] text-gray-400">{t.area}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SidebarCard>
          )}

          {/* Genererade avtal */}
          <SidebarCard>
            <CardTitle
              icon={FileSignature}
              title="Genererade avtal"
              iconColor="#B5453B"
              action={<button onClick={() => navigate('/dashboard/verktyg/avtal')} className="text-xs text-[#0E3047] hover:underline">Skapa</button>}
            />
            {contracts.length > 0 ? (
              <div className="space-y-2">
                {contracts.slice(0, 4).map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5">
                    <FileSignature size={14} className="text-[#B5453B] flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[#0E3047] truncate">{c.title || CONTRACT_LABELS[c.contract_type]}</p>
                      <p className="text-[11px] text-gray-400">{new Date(c.created_at).toLocaleDateString('sv-SE')}{c.status === 'flagged' && ' · granskas'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#4B6680]">Inga avtal ännu. Skapa NDA eller anställningsavtal i Avtalsmotorn.</p>
            )}
          </SidebarCard>

          {/* Dokumentarkiv (slim) */}
          <SidebarCard>
            <CardTitle icon={FolderOpen} title="Dokumentarkiv" />
            <p className="text-sm text-[#4B6680]">
              {contracts.length > 0
                ? `${contracts.length} dokument. Öppna ett avtal i Avtalsmotorn för PDF-export.`
                : 'Dina dokument samlas här när du skapar avtal eller kör Health Check.'}
            </p>
          </SidebarCard>

          {/* Regulatoriska krav — platshållare */}
          <SidebarCard accent="#C18B2A">
            <CardTitle icon={Scale} title="Regulatoriska krav" iconColor="#C18B2A" />
            <div className="flex items-start gap-2.5">
              <Lock size={14} className="text-[#C18B2A] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#4B6680]">
                Kartläggning av tillstånd och regelkrav för din bransch — kommer snart.
              </p>
            </div>
          </SidebarCard>
        </aside>
      </div>
    </div>
  )
}
