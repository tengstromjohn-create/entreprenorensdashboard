import { Activity, ArrowRight } from 'lucide-react'
import { StatusIndicator } from './StatusIndicator'
import type { HealthCheckResult } from '@/types/dashboard'

interface Props {
  result: HealthCheckResult
  onRunAgain: () => void
  onViewDetails: () => void
}

export function HealthCheckSummary({ result, onRunAgain, onViewDetails }: Props) {
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (result.overall_score / 100) * circumference
  const scoreColor = result.overall_score >= 70 ? '#16A34A' : result.overall_score >= 40 ? '#EAB308' : '#DC2626'

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={18} className="text-[#2D3436]" />
        <h3 className="font-semibold text-[#2D3436]">Corporate Health Check</h3>
        <span className="text-xs text-gray-400 ml-auto">
          {new Date(result.created_at).toLocaleDateString('sv-SE')}
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#F3F4F6" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke={scoreColor}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-[#2D3436]">{result.overall_score}</span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          {result.areas.map((area) => (
            <div key={area.name} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{area.name}</span>
              <StatusIndicator status={area.status} size="sm" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={onViewDetails}
          className="flex-1 bg-[#F5F5F0] text-[#2D3436] py-2 rounded-lg text-sm font-medium hover:bg-[#E8E4DE] transition-colors flex items-center justify-center gap-1"
        >
          Visa detaljer
          <ArrowRight size={14} />
        </button>
        <button
          onClick={onRunAgain}
          className="flex-1 bg-[#2D3436] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#3d4446] transition-colors"
        >
          Kör igen
        </button>
      </div>
    </div>
  )
}
