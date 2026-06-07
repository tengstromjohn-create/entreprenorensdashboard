import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanyData } from '@/hooks/useCompanyData'
import { useHealthCheck } from '@/hooks/useHealthCheck'
import { CompanyCard } from '@/components/shared/CompanyCard'
import { HealthCheckSummary } from '@/components/shared/HealthCheckSummary'
import { TrustBadge } from '@/components/shared/TrustBadge'
import { hasTrustLevel } from '@/types/dashboard'
import { Users, ArrowRight, Rocket, Search, FileSignature, Loader2, AlertCircle, Building2, ChevronDown, GraduationCap } from 'lucide-react'

const SIGNATORY_LABELS: Record<string, string> = {
  individually: 'Var för sig',
  jointly_two: 'Två i förening',
  jointly_three: 'Tre i förening',
  jointly_all: 'Samtliga i förening',
  other: 'Särskild reglering',
}

function formatOrgNumber(org: string): string {
  const c = org.replace('-', '')
  return c.length === 10 ? `${c.slice(0, 6)}-${c.slice(6)}` : org
}

export function CompanyZone() {
  const { user, profile, trustLevel, activeCompany, setActiveCompany } = useAuth()
  const navigate = useNavigate()
  const { companyData, loading, error, refreshCompanyData, fetchFromProfile } = useCompanyData(user?.id)
  const { latestResult } = useHealthCheck(user?.id)

  const engagements = profile?.engagements?.items ?? []
  const hasEngagements = engagements.length > 0

  const [selectedOrg, setSelectedOrg] = useState<string | null>(null)
  const [orgInput, setOrgInput] = useState('')
  const [searchTouched, setSearchTouched] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // Förvald: ladda profilens sparade bolag (om något), annars inget förrän användaren väljer
  useEffect(() => {
    if (!hasEngagements) fetchFromProfile()
  }, [fetchFromProfile, hasEngagements])

  // Återställ senast valda bolag (aktivt bolag delas med Health Check/Avtalsmotorn
  // via AuthContext + sessionStorage — BankID-användare kan inte läsa det från DB:n)
  useEffect(() => {
    if (activeCompany && !companyData && !selectedOrg && !searchTouched) {
      setSelectedOrg(activeCompany.orgNumber)
      handleSelectCompany(activeCompany.orgNumber)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelectCompany = async (org: string) => {
    setSelectedOrg(org)
    setSearchTouched(true)
    const data = await refreshCompanyData(org)
    if (data) setActiveCompany(data)
  }

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    if (!orgInput.trim()) return
    setSelectedOrg(orgInput.trim())
    setSearchTouched(true)
    const data = await refreshCompanyData(orgInput.trim())
    if (data) setActiveCompany(data)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#0E3047]">Dina bolag</h1>
        <TrustBadge level={trustLevel} size="sm" />
      </div>

      {/* PRIMÄR VY: Dina bolag (engagemang från BankID-inloggning) */}
      {hasEngagements && (
        <div className="space-y-3">
          <p className="text-sm text-[#4B6680]">
            Bolag du företräder enligt Bolagsverket. Välj ett bolag för att se firmateckning, styrelse och bolagsinformation.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {engagements.map((eng) => {
              const isSelected = selectedOrg === eng.orgNumber
              return (
                <button
                  key={eng.orgNumber}
                  onClick={() => handleSelectCompany(eng.orgNumber)}
                  className={`text-left bg-white rounded-lg border p-4 transition-all relative overflow-hidden hover:shadow-sm ${
                    isSelected ? 'border-[#0E3047] ring-1 ring-[#0E3047]/20' : 'border-[#E8E4DE] hover:border-[#0E3047]/40'
                  }`}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#0E3047]" />
                  <div className="flex items-start gap-3 pl-1">
                    <div className="bg-[#F5F5F0] rounded-lg p-2 shrink-0">
                      <Building2 size={18} className="text-[#0E3047]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-[#0E3047] text-sm truncate">{eng.companyName}</h3>
                      <p className="text-xs text-gray-500 mb-1.5">Org.nr: {formatOrgNumber(eng.orgNumber)}</p>
                      {eng.roles.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {eng.roles.map((role, i) => (
                            <span key={i} className="text-[10px] bg-[#F5F5F0] text-[#4B6680] px-2 py-0.5 rounded-full">
                              {role}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {isSelected && loading
                      ? <Loader2 size={16} className="animate-spin text-[#0E3047] shrink-0" />
                      : <ArrowRight size={16} className="text-gray-400 shrink-0" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* EMPTY STATE: BankID-användare utan engagemang */}
      {!hasEngagements && hasTrustLevel(trustLevel, 'bankid') && !companyData && !loading && (
        <div className="bg-[#F5F5F0] rounded-lg p-8 text-center">
          <Rocket size={40} className="text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#0E3047] mb-2">Du företräder inget aktivt bolag</h2>
          <p className="text-sm text-[#4B6680] mb-6 max-w-md mx-auto">
            Vi hittade inga bolagsuppdrag kopplade till dig hos Bolagsverket. Vill du starta ett bolag?
            Startup Kit hjälper dig hela vägen — med rätt dokument och en 90-dagarsplan.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => navigate('/dashboard/verktyg')}
              className="bg-[#B5453B] text-[#FAF6EE] px-6 py-3 rounded-lg font-medium hover:bg-[#9E3B32] transition-colors inline-flex items-center gap-2"
            >
              <Rocket size={16} />
              Utforska Startup Kit
            </button>
            <button
              onClick={() => navigate('/dashboard/verktyg')}
              className="bg-white text-[#0E3047] border border-[#E8E4DE] px-6 py-3 rounded-lg font-medium hover:border-[#0E3047]/40 transition-colors inline-flex items-center gap-2"
            >
              <GraduationCap size={16} />
              Se utbildningar
            </button>
          </div>
        </div>
      )}

      {/* SEKUNDÄR: manuellt uppslag (kvar som separat funktion — motpartsuppslag/admin) */}
      <div className="bg-white rounded-lg border border-[#E8E4DE] overflow-hidden">
        <button
          onClick={() => setSearchOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-[#FAF6EE]/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Search size={16} className="text-[#4B6680]" />
            <span className="font-medium text-[#0E3047] text-sm">Slå upp annat bolag via organisationsnummer</span>
          </div>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${searchOpen ? 'rotate-180' : ''}`} />
        </button>
        {searchOpen && (
          <div className="px-5 pb-5 pt-1">
            <p className="text-xs text-[#4B6680] mb-3">
              Hämta firmateckning, styrelse och bolagsinformation för valfritt bolag från Bolagsverket via Roaring.
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
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-[#B5453B] bg-[#B5453B]/5 border border-[#B5453B]/20 rounded-lg p-3">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
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

      {/* Firmateckning */}
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

      {/* Empty state för icke-BankID utan bolagsdata (org_nr-spår) */}
      {!hasEngagements && !hasTrustLevel(trustLevel, 'bankid') && !companyData && !loading && !searchTouched && (
        <div className="bg-[#F5F5F0] rounded-lg p-8 text-center">
          <Rocket size={40} className="text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#0E3047] mb-2">Logga in med BankID för att se dina bolag</h2>
          <p className="text-sm text-[#4B6680] mb-6 max-w-md mx-auto">
            Med BankID hämtar vi automatiskt de bolag du företräder. Du kan även slå upp ett valfritt
            bolag via organisationsnummer ovan.
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
    </div>
  )
}
