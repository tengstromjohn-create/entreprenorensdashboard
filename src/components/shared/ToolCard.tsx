import {
  Lock, ArrowRight, ExternalLink,
  Rocket, HeartPulse, CheckSquare, ClipboardList, Sparkles, Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { ToolDefinition, TrustLevel } from '@/types/dashboard'
import { hasTrustLevel } from '@/types/dashboard'

const ICON_MAP: Record<string, LucideIcon> = {
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
  const isPremium = tool.requiresPurchase || (tool.price && tool.price !== 'Gratis')

  const Icon = ICON_MAP[tool.icon] || Wrench

  // Top-stripe färg: premium = tegel, kommer snart = mässing, övrigt = navy
  const stripeColor = tool.comingSoon ? '#C18B2A' : (isPremium ? '#B5453B' : '#0E3047')

  const renderCta = () => {
    if (tool.comingSoon) {
      return (
        <span className="text-xs text-[#C18B2A] font-medium">
          Lanseras 2026
        </span>
      )
    }
    if (!isAccessible) {
      return (
        <button
          onClick={onUpgrade}
          className="text-sm text-[#0E3047] font-medium flex items-center gap-1 hover:underline"
        >
          <Lock size={14} />
          Kräver BankID
        </button>
      )
    }
    if (needsPurchase && tool.externalUrl) {
      // Premium-CTA — tegelröd
      return (
        <button
          onClick={() => onPurchase(tool.externalUrl!)}
          className="bg-[#B5453B] text-[#FAF6EE] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9F3A30] transition-colors flex items-center gap-1"
        >
          Köp ({tool.price})
          <ExternalLink size={14} />
        </button>
      )
    }
    if (tool.route) {
      // Gratis-CTA — navy
      return (
        <button
          onClick={() => onNavigate(tool.route!)}
          className="bg-[#0E3047] text-[#FAF6EE] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1A4060] transition-colors flex items-center gap-1"
        >
          {hasPurchased ? 'Använd' : (tool.price === 'Gratis' ? 'Starta' : 'Öppna')}
          <ArrowRight size={14} />
        </button>
      )
    }
    return null
  }

  // Bakgrund för ikon-container baserat på stripeColor + opacity
  const iconBg = isLocked
    ? '#F5F5F0'
    : (stripeColor === '#0E3047' ? 'rgba(14,48,71,0.08)'
      : stripeColor === '#B5453B' ? 'rgba(181,69,59,0.10)'
      : 'rgba(193,139,42,0.12)')

  return (
    <div className={`relative bg-white rounded-lg border border-[#E8E4DE] p-5 transition-shadow duration-200 overflow-hidden ${
      isLocked ? 'opacity-75' : 'hover:shadow-md'
    }`}>
      {/* Top-stripe — visuell identitet per korttyp */}
      <div className="absolute left-0 top-0 right-0 h-[3px]" style={{ backgroundColor: stripeColor }} />

      {tool.badge && (
        <span className="absolute top-2 right-3 text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ backgroundColor: '#B5453B', color: '#FAF6EE' }}>
          {tool.badge}
        </span>
      )}

      <div className="flex items-start gap-4 mt-1">
        <div
          className="rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg, width: '44px', height: '44px' }}
        >
          <Icon size={22} className={isLocked ? 'text-gray-400' : ''} style={{ color: isLocked ? undefined : stripeColor }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-[#0E3047] text-sm">{tool.name}</h3>
            {tool.price && (
              <span className={`text-xs font-medium ${tool.price === 'Gratis' ? 'text-[#3A5A40]' : 'text-[#4B6680]'}`}>
                {tool.price}
              </span>
            )}
          </div>
          <p className="text-sm text-[#4B6680] mb-3">{tool.description}</p>
          {renderCta()}
        </div>
      </div>
    </div>
  )
}
