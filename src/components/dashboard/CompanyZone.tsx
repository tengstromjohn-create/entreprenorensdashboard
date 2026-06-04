import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanyData } from '@/hooks/useCompanyData'
import { useHealthCheck } from '@/hooks/useHealthCheck'
import { CompanyCard } from '@/components/shared/CompanyCard'
import { HealthCheckSummary } from '@/components/shared/HealthCheckSummary'
import { TrustBadge } from '@/components/shared/TrustBadge'
import { hasTrustLevel } from '@/types/dashboard'
import { Users, ArrowRight, Rocket, Search, FileSignature, Loader2, AlertCircle } from 'lucide-react'

const SIGNATORY_LABELS: Record<string, string> = {
  individually: 'Var för sig',
  jointly_two: 'Två i förening',
  jointly_three: 'Tre i förening',
  jointly_all: 'Samtliga i förening',
  other: 'Särskild reglering',
}

export function CompanyZone() {
  const { user, profile, trustLevel } = useAuth()
  const navigate = useNavigate()
  const { companyData, loading, error, refreshCompanyData, fetchFromProfile } = useCompanyData(user?.id)
  const { latestResult } = useHealthCheck(user?.id)

  const [orgInput, setOrgInput] = useState('')
  const [searchTouched, setSearchTouched] = useState(false)

  useEffect(() => {
    fetchFromProfile()
  }, [fetchFromProfile])

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    if (!orgInput.trim()) return
    setSearchTouched(true)
    await refreshCompanyData(orgInput.trim())
  }

  const isEmpty = !loading && !companyData && !profile?.org_number && !searchTouched

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#0E3047]">Mitt bolag</h1>
        <TrustBadge level={trustLevel} size="sm" />
      </div>

      {/* Sök/uppdatera-formulär — alltid synligt */}
      <div className="bg-white rounded-lg border border-[#E8E4DE] p-5 relative overflow-hidden">
        <div className="absolute left-0 top-0 right-0 h-[3px] bg-[#0E3047]" />
        <div className="flex items-center gap-2 mb-3">
          <Search size={16} className="text-[#0E3047]" />
          <h3 className="font-semibold text-[#0E3047] text-sm">Slå upp bolag via organisationsnummer</h3>
        </div>
        <p className="text-xs text-[#4B6680] mb-3">
          Hämta firmateckning, styrelse och bolagsinformation från Bolagsverket via Roaring.
        </p>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={orgInput}
            onChange={(e) => setOrgInput(e.target.value)}
            placeholder="Ex: 559123-1850"
            className="flex-1 px-3 py-2 rounded-lg border border-[#E8E4DE] text-sm text-[#0E3047] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0E3047]/20"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !orgInput.trim()}
            className="bg-[#0E3047] text-[#FAF6EE] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1A4060] transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {loading ? 'Söker...' : 'Slå upp'}
          </button>
        </form>
        {error && (
          <div className="mt-3 flex items-start gap-2 text-xs text-[#B5453B]">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Empty state — innan första sökning, inget profil-bolag */}
      {isEmpty && (
        <div className="bg-[#F5F5F0] rounded-lg p-8 text-center">
          <Rocket size={40} className="text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#0E3047] mb-2">Har du inte bildat bolag än?</h2>
          <p className="text-sm text-[#4B6680] mb-6 max-w-md mx-auto">
            Startup Kit hjälper dig att bilda aktiebolag med rätt dokument och en 90-dagarsplan.
            Skräddarsytt efter din situation.
          </p>
          <button
            onClick={() => navigate('/dashboard/verktyg')}
            className="bg-[#0E3047] text-[#FAF6EE] px-6 py-3 rounded-lg font-medium hover:bg-[#1A4060] transition-colors inline-flex items-center gap-2"
          >
            Utforska Startup Kit
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {companyData && (
        <CompanyCard
          company={companyData}
          lastUpdated={profile?.updated_at}
          onRefresh={() => companyData.orgNumber && refreshCompanyData(companyData.orgNumber)}
          refreshing={loading}
        />
      )}

      {/* Firmateckning — NY för Spurt A */}
      {companyData?.signatory && (
        <div className="bg-white rounded-lg border border-[#E8E4DE] p-5 relative overflow-hidden">
          <div className="absolute left-0 top-0 right-0 h-[3px] bg-[#B5453B]" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileSignature size={18} className="text-[#B5453B]" />
              <h3 className="font-semibold text-[#0E3047]">Firmateckning</h3>
            </div>
            <span
              className="text-[10px] font-medium px-2 py-1 rounded-full uppercase tracking-wider"
              style={{ backgroundColor: 'rgba(181,69,59,0.10)', color: '#B5453B' }}
            >
              {SIGNATORY_LABELS[companyData.signatory.rule] || 'Okänd'}
            </span>
          </div>
          {companyData.signatory.description && (
            <p className="text-sm text-[#4B6680] mb-3 leading-relaxed">
              {companyData.signatory.description}
            </p>
          )}
          {companyData.signatory.authorizedPersons && companyData.signatory.authorizedPersons.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#0E3047] mb-2 mt-3">Behöriga firmatecknare</p>
              <div className="flex flex-wrap gap-2">
                {companyData.signatory.authorizedPersons.map((name, i) => (
                  <span
                    key={i}
                    className="text-xs bg-[#F5F5F0] text-[#0E3047] px-2.5 py-1 rounded-full"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Styrelse */}
      {companyData?.boardMembers && companyData.boardMembers.length > 0 && (
        <div className="bg-white rounded-lg border border-[#E8E4DE] p-5 relative overflow-hidden">
          <div className="absolute left-0 top-0 right-0 h-[3px] bg-[#0E3047]" />
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-[#0E3047]" />
            <h3 className="font-semibold text-[#0E3047]">Styrelse</h3>
          </div>
          <div className="space-y-2">
            {companyData.boardMembers.map((member, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[#E8E4DE]/40 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#0E3047]">{member.name}</span>
                  {hasTrustLevel(trustLevel, 'bankid') &&
                   member.personalNumberHash === profile?.personal_number_hash && (
                    <span className="text-[10px] bg-[#3A5A40]/10 text-[#3A5A40] px-1.5 py-0.5 rounded-full font-medium">Du</span>
                  )}
                </div>
                <span className="text-sm text-[#4B6680]">{member.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Health Check-block — bara om vi har bolagsdata */}
      {companyData && (
        latestResult ? (
          <HealthCheckSummary
            result={latestResult}
            onRunAgain={() => navigate('/dashboard/verktyg/health-check')}
            onViewDetails={() => navigate('/dashboard/verktyg/health-check')}
          />
        ) : (
          <div className="bg-[#F5F5F0] rounded-lg p-6 text-center">
            <p className="text-sm text-[#4B6680] mb-3">Du har inte kört Health Check ännu.</p>
            <button
              onClick={() => navigate('/dashboard/verktyg/health-check')}
              className="bg-[#0E3047] text-[#FAF6EE] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1A4060] transition-colors"
            >
              Kör din första Health Check
            </button>
          </div>
        )
      )}
    </div>
  )
}
