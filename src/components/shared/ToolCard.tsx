import {
  Lock, ArrowRight, ExternalLink,
  Rocket, HeartPulse, CheckSquare, ClipboardList, Sparkles, Wrench,
} from 'lucide-react'
import type { ToolDefinition, TrustLevel } from '@/types/dashboard'
import { hasTrustLevel } from '@/types/dashboard'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Rocket, HeartPulse, CheckSquare, ClipboardList, Sparkles, Wrench,
}

interface Props {
  tool: ToolDefinition
  userTrust: TrustLevel
  hasPurchased: boolean
  onNavigate: (route: string) => void
  onUpgrade: () => void
  onPurchase: (url: string) => void
}

export function ToolCard({ tool, userTrust, hasPurchased, onNavigate, onUpgrade, onPurchase }: Props) {
  const isAccessible = hasTrustLevel(userTrust, tool.requiredTrust)
  const needsPurchase = tool.requiresPurchase && !hasPurchased
  const isLocked = !isAccessible || tool.comingSoon

  const Icon = ICON_MAP[tool.icon] || Wrench

  const renderCta = () => {
    if (tool.comingSoon) {
      return (
        <span className="text-xs text-gray-400 font-medium">
          Lanseras 2026
        </span>
      )
    }
    if (!isAccessible) {
      return (
        <button
          onClick={onUpgrade}
          className="text-sm text-[#2D3436] font-medium flex items-center gap-1 hover:underline"
        >
          <Lock size={14} />
          Kräver BankID
        </button>
      )
    }
    if (needsPurchase && tool.externalUrl) {
      return (
        <button
          onClick={() => onPurchase(tool.externalUrl!)}
          className="bg-[#2D3436] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#3d4446] transition-colors flex items-center gap-1"
        >
          Köp ({tool.price})
          <ExternalLink size={14} />
        </button>
      )
    }
    if (tool.route) {
      return (
        <button
          onClick={() => onNavigate(tool.route!)}
          className="bg-[#2D3436] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#3d4446] transition-colors flex items-center gap-1"
        >
          {hasPurchased ? 'Använd' : (tool.price === 'Gratis' ? 'Starta' : 'Öppna')}
          <ArrowRight size={14} />
        </button>
      )
    }
    return null
  }

  return (
    <div className={`relative bg-white rounded-lg border border-gray-100 p-5 transition-shadow duration-200 ${
      isLocked ? 'opacity-75' : 'hover:shadow-md'
    }`}>
      {tool.badge && (
        <span className="absolute -top-2 right-3 bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
          {tool.badge}
        </span>
      )}

      <div className="flex items-start gap-4">
        <div className={`rounded-lg p-2.5 ${isLocked ? 'bg-gray-100' : 'bg-[#F5F5F0]'}`}>
          <Icon size={22} className={isLocked ? 'text-gray-400' : 'text-[#2D3436]'} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-[#2D3436] text-sm">{tool.name}</h3>
            {tool.price && (
              <span className={`text-xs font-medium ${tool.price === 'Gratis' ? 'text-green-600' : 'text-gray-500'}`}>
                {tool.price}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-3">{tool.description}</p>
          {renderCta()}
        </div>
      </div>
    </div>
  )
}
