import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanyData } from '@/hooks/useCompanyData'
import { useHealthCheck } from '@/hooks/useHealthCheck'
import { CompanyCard } from '@/components/shared/CompanyCard'
import { HealthCheckSummary } from '@/components/shared/HealthCheckSummary'
import { TrustBadge } from '@/components/shared/TrustBadge'
import { hasTrustLevel } from '@/types/dashboard'
import { Users, ArrowRight, Rocket } from 'lucide-react'

export function CompanyZone() {
  const { user, profile, trustLevel } = useAuth()
  const navigate = useNavigate()
  const { companyData, loading, refreshCompanyData, fetchFromProfile } = useCompanyData(user?.id)
  const { latestResult } = useHealthCheck(user?.id)

  useEffect(() => {
    fetchFromProfile()
  }, [fetchFromProfile])

  if (!loading && !companyData && !profile?.org_number) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-[#2D3436]">Mitt bolag</h1>
        <div className="bg-[#F5F5F0] rounded-lg p-8 text-center">
          <Rocket size={40} className="text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#2D3436] mb-2">Har du inte bildat bolag än?</h2>
          <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
            Startup Kit hjälper dig att bilda aktiebolag med rätt dokument och en 90-dagarsplan.
            Skräddarsytt efter din situation.
          </p>
          <button
            onClick={() => navigate('/dashboard/verktyg')}
            className="bg-[#2D3436] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#3d4446] transition-colors inline-flex items-center gap-2"
          >
            Utforska Startup Kit
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#2D3436]">Mitt bolag</h1>
        <TrustBadge level={trustLevel} size="sm" />
      </div>

      {companyData && (
        <CompanyCard
          company={companyData}
          lastUpdated={profile?.updated_at}
          onRefresh={() => companyData.orgNumber && refreshCompanyData(companyData.orgNumber)}
          refreshing={loading}
        />
      )}

      {companyData?.boardMembers && companyData.boardMembers.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-[#2D3436]" />
            <h3 className="font-semibold text-[#2D3436]">Styrelse</h3>
          </div>
          <div className="space-y-2">
            {companyData.boardMembers.map((member, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#2D3436]">{member.name}</span>
                  {hasTrustLevel(trustLevel, 'bankid') &&
                   member.personalNumberHash === profile?.personal_number_hash && (
                    <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">Du</span>
                  )}
                </div>
                <span className="text-sm text-gray-500">{member.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {latestResult ? (
        <HealthCheckSummary
          result={latestResult}
          onRunAgain={() => navigate('/dashboard/verktyg/health-check')}
          onViewDetails={() => navigate('/dashboard/verktyg/health-check')}
        />
      ) : (
        <div className="bg-[#F5F5F0] rounded-lg p-6 text-center">
          <p className="text-sm text-gray-600 mb-3">Du har inte kört Health Check ännu.</p>
          <button
            onClick={() => navigate('/dashboard/verktyg/health-check')}
            className="bg-[#2D3436] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#3d4446] transition-colors"
          >
            Kör din första Health Check
          </button>
        </div>
      )}
    </div>
  )
}
