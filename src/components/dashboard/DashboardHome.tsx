import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanyData } from '@/hooks/useCompanyData'
import { useHealthCheck } from '@/hooks/useHealthCheck'
import { ArrowRight, Building2, Wrench, BookOpen, Sparkles } from 'lucide-react'

export function DashboardHome() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { companyData } = useCompanyData(user?.id)
  const { latestResult } = useHealthCheck(user?.id)

  return (
    <div className="space-y-8">
      {/* Hero med byggrits-stil signaturlinje — suggererar fundament */}
      <div>
        <h1 className="text-3xl font-bold text-[#0E3047] tracking-tight">
          Hej, {profile?.display_name?.split(' ')[0] || 'Entreprenör'}
        </h1>
        <div className="mt-2 flex items-center gap-2" aria-hidden="true">
          <span className="h-[3px] w-12 bg-[#B5453B] rounded-sm" />
          <span className="h-[3px] w-1 bg-[#B5453B] rounded-sm" />
          <span className="h-[3px] w-3 bg-[#B5453B]/50 rounded-sm" />
        </div>
        <p className="text-[#4B6680] mt-3 text-sm">
          Välkommen tillbaka. Här är din översikt.
        </p>
      </div>

      {/* Rekommenderat nästa steg — banner med tegelröd vänsterkant */}
      {!latestResult && (
        <div className="bg-white rounded-lg border border-[#E8E4DE] p-5 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#B5453B]" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-[11px] font-semibold tracking-wider text-[#B5453B] uppercase">
                Rekommenderat nästa steg
              </p>
              <h3 className="text-lg font-semibold text-[#0E3047] mt-1">
                Kör Corporate Health Check
              </h3>
              <p className="text-sm text-[#4B6680] mt-1">
                AI-driven analys av 5 nyckelområden — gratis, tar ~5 minuter.
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard/verktyg/health-check')}
              className="bg-[#B5453B] text-[#FAF6EE] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9F3A30] transition-colors flex items-center gap-1.5 shrink-0"
            >
              Starta
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Tre översiktskort med top-stripes */}
      <div className="grid gap-5 md:grid-cols-3">
        <button
          onClick={() => navigate('/dashboard/bolag')}
          className="text-left bg-white rounded-lg border border-[#E8E4DE] p-5 hover:shadow-md transition-shadow relative overflow-hidden group"
        >
          <div className="absolute left-0 top-0 right-0 h-[3px] bg-[#0E3047]" />
          <div className="w-10 h-10 rounded-lg bg-[#0E3047]/8 flex items-center justify-center mb-3" style={{ backgroundColor: 'rgba(14,48,71,0.08)' }}>
            <Building2 size={18} className="text-[#0E3047]" />
          </div>
          <h3 className="font-semibold text-[#0E3047] mb-1">Mitt bolag</h3>
          <p className="text-sm text-[#4B6680] mb-4">
            {companyData ? companyData.name : 'Lägg till ditt bolag'}
          </p>
          <span className="text-xs text-[#0E3047] font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            Visa mer <ArrowRight size={12} />
          </span>
        </button>

        <button
          onClick={() => navigate('/dashboard/verktyg')}
          className="text-left bg-white rounded-lg border border-[#E8E4DE] p-5 hover:shadow-md transition-shadow relative overflow-hidden group"
        >
          <div className="absolute left-0 top-0 right-0 h-[3px] bg-[#B5453B]" />
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: 'rgba(181,69,59,0.10)' }}>
            <Wrench size={18} className="text-[#B5453B]" />
          </div>
          <h3 className="font-semibold text-[#0E3047] mb-1">Verktyg</h3>
          <p className="text-sm text-[#4B6680] mb-4">
            {latestResult ? `Health Check: ${latestResult.overall_score}/100` : 'Kör din första Health Check'}
          </p>
          <span className="text-xs text-[#B5453B] font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            Visa alla <ArrowRight size={12} />
          </span>
        </button>

        <button
          onClick={() => navigate('/dashboard/utveckling')}
          className="text-left bg-white rounded-lg border border-[#E8E4DE] p-5 hover:shadow-md transition-shadow relative overflow-hidden group"
        >
          <div className="absolute left-0 top-0 right-0 h-[3px] bg-[#C18B2A]" />
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(193,139,42,0.12)' }}>
              <BookOpen size={18} className="text-[#C18B2A]" />
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5" style={{ backgroundColor: 'rgba(193,139,42,0.15)', color: '#C18B2A' }}>
              <Sparkles size={9} />
              Snart
            </span>
          </div>
          <h3 className="font-semibold text-[#0E3047] mb-1">Min utveckling</h3>
          <p className="text-sm text-[#4B6680] mb-4">
            Kunskapsbibliotek, mallar och community
          </p>
          <span className="text-xs text-[#C18B2A] font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            Läs mer <ArrowRight size={12} />
          </span>
        </button>
      </div>
    </div>
  )
}
