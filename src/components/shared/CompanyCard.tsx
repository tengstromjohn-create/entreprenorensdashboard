import { Building2, RefreshCw, Calendar, MapPin, Hash } from 'lucide-react'
import type { CompanyData } from '@/types/dashboard'

interface Props {
  company: CompanyData
  lastUpdated?: string
  onRefresh: () => void
  refreshing: boolean
}

export function CompanyCard({ company, lastUpdated, onRefresh, refreshing }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-[#F5F5F0] rounded-lg p-2.5">
            <Building2 size={22} className="text-[#2D3436]" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-[#2D3436]">{company.name}</h2>
            <p className="text-sm text-gray-500">Org.nr: {company.orgNumber}</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="text-sm text-gray-500 hover:text-[#2D3436] flex items-center gap-1 transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Uppdatera
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        {company.sede && (
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin size={14} className="text-gray-400" />
            <span>{company.sede}</span>
          </div>
        )}
        {company.registrationDate && (
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar size={14} className="text-gray-400" />
            <span>Reg: {new Date(company.registrationDate).toLocaleDateString('sv-SE')}</span>
          </div>
        )}
        {company.sniCode && (
          <div className="flex items-center gap-2 text-gray-600 col-span-2">
            <Hash size={14} className="text-gray-400" />
            <span>SNI: {company.sniCode} — {company.sniDescription}</span>
          </div>
        )}
      </div>

      {lastUpdated && (
        <p className="text-xs text-gray-400 mt-4">
          Senast uppdaterad: {new Date(lastUpdated).toLocaleDateString('sv-SE')}
        </p>
      )}
    </div>
  )
}
