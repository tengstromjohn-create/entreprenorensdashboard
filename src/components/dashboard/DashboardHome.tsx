import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanyData } from '@/hooks/useCompanyData'
import { useHealthCheck } from '@/hooks/useHealthCheck'
import { ArrowRight, Rocket, Activity, BookOpen } from 'lucide-react'

export function DashboardHome() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { companyData } = useCompanyData(user?.id)
  const { latestResult } = useHealthCheck(user?.id)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#2D3436]">
          Hej, {profile?.display_name?.split(' ')[0] || 'Entreprenör'}
        </h1>
        <p className="text-gray-500 mt-1">Välkommen till Grundat. Här är din översikt.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <button
          onClick={() => navigate('/dashboard/bolag')}
          className="text-left bg-[#F5F5F0] rounded-lg p-5 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-3">
            <Rocket size={18} className="text-[#2D3436]" />
            <span className="font-semibold text-sm text-[#2D3436]">Mitt bolag</span>
          </div>
          <p className="text-sm text-gray-600">
            {companyData ? companyData.name : 'Lägg till ditt bolag'}
          </p>
          <span className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            Visa mer <ArrowRight size={12} />
          </span>
        </button>

        <button
          onClick={() => navigate('/dashboard/verktyg')}
          className="text-left bg-[#F5F5F0] rounded-lg p-5 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-3">
            <Activity size={18} className="text-[#2D3436]" />
            <span className="font-semibold text-sm text-[#2D3436]">Verktyg</span>
          </div>
          <p className="text-sm text-gray-600">
            {latestResult ? `Health Check: ${latestResult.overall_score}/100` : 'Kör din första Health Check'}
          </p>
          <span className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            Visa alla <ArrowRight size={12} />
          </span>
        </button>

        <button
          onClick={() => navigate('/dashboard/utveckling')}
          className="text-left bg-[#F5F5F0] rounded-lg p-5 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={18} className="text-[#2D3436]" />
            <span className="font-semibold text-sm text-[#2D3436]">Min utveckling</span>
            <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">
              Snart
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Kunskapsbibliotek, mallar och community
          </p>
          <span className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            Läs mer <ArrowRight size={12} />
          </span>
        </button>
      </div>
    </div>
  )
}
