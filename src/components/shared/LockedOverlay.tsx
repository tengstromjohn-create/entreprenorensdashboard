import { Lock } from 'lucide-react'

interface Props {
  reason: string
  ctaText: string
  onCtaClick: () => void
  children: React.ReactNode
}

export function LockedOverlay({ reason, ctaText, onCtaClick, children }: Props) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 bg-[#F5F5F0]/80 backdrop-blur-[1px] rounded-lg flex flex-col items-center justify-center gap-3">
        <div className="bg-white rounded-full p-3 shadow-sm">
          <Lock className="text-gray-400" size={24} />
        </div>
        <p className="text-sm text-gray-600 font-medium text-center px-4">{reason}</p>
        <button
          onClick={onCtaClick}
          className="bg-[#2D3436] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#3d4446] transition-colors"
        >
          {ctaText}
        </button>
      </div>
    </div>
  )
}
