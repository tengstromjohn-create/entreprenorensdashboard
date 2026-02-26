import { Shield, ShieldCheck, Clock, Star } from 'lucide-react'
import { TRUST_LEVELS, type TrustLevel } from '@/types/dashboard'

interface Props {
  level: TrustLevel
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = { Shield, ShieldCheck, Clock, Star }

export function TrustBadge({ level, size = 'md', showLabel = true }: Props) {
  const config = TRUST_LEVELS[level]
  const Icon = ICONS[config.icon] || Shield

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-3 py-1 gap-1.5',
    lg: 'text-base px-4 py-1.5 gap-2',
  }

  const iconSizes = { sm: 12, md: 14, lg: 16 }

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${config.bgColor} ${config.color} ${sizeClasses[size]}`}>
      <Icon size={iconSizes[size]} />
      {showLabel && <span>{config.label}</span>}
    </span>
  )
}
