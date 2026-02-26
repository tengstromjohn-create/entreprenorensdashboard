import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useProducts } from '@/hooks/useProducts'
import { ToolCard } from '@/components/shared/ToolCard'
import { UpgradeModal } from '@/components/shared/UpgradeModal'
import type { ToolDefinition } from '@/types/dashboard'

const TOOLS: ToolDefinition[] = [
  {
    id: 'startup-kit',
    name: 'Startup Kit',
    description: 'Skräddarsydda bolagsdokument och 90-dagarsplan',
    icon: 'Rocket',
    price: '1 490 kr',
    route: '/dashboard/verktyg/startup-kit',
    externalUrl: 'https://johntengstrom.se/checkout/startup-kit',
    requiredTrust: 'bankid',
    requiresPurchase: true,
    productKey: 'startup_kit',
    badge: 'Populär',
  },
  {
    id: 'health-check',
    name: 'Corporate Health Check',
    description: 'Hur mår ditt bolag? AI-driven analys av 5 nyckelområden',
    icon: 'HeartPulse',
    price: 'Gratis',
    route: '/dashboard/verktyg/health-check',
    requiredTrust: 'org_nr',
  },
  {
    id: 'readiness-check',
    name: 'Readiness Check',
    description: 'Utvärdera din strategiska mognad innan bolagsbildning',
    icon: 'CheckSquare',
    price: 'Gratis',
    route: '/dashboard/verktyg/readiness-check',
    requiredTrust: 'bankid',
  },
  {
    id: 'checklists',
    name: 'Checklistor & Mallar',
    description: 'Kommenterade mallar för styrelsearbete, avtal och mer',
    icon: 'ClipboardList',
    route: '/dashboard/verktyg/checklistor',
    requiredTrust: 'org_nr',
  },
  {
    id: 'legal-source-genie',
    name: 'Legal Source Genie',
    description: 'AI-driven juridisk research — hitta rätt rättskällor snabbt',
    icon: 'Sparkles',
    price: 'Kommer snart',
    requiredTrust: 'bankid',
    comingSoon: true,
  },
]

export function ToolsZone() {
  const { user, trustLevel, signInWithBankID } = useAuth()
  const navigate = useNavigate()
  const { hasProduct } = useProducts(user?.id)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const handleNavigate = (route: string) => navigate(route)

  const handlePurchase = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleBankId = async () => {
    setUpgradeOpen(false)
    await signInWithBankID()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#2D3436]">Verktyg</h1>
        <p className="text-sm text-gray-500 mt-1">
          Verktyg för att starta, driva och utveckla ditt bolag
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {TOOLS.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            userTrust={trustLevel}
            hasPurchased={tool.productKey ? hasProduct(tool.productKey) : false}
            onNavigate={handleNavigate}
            onUpgrade={() => setUpgradeOpen(true)}
            onPurchase={handlePurchase}
          />
        ))}
      </div>

      <div className="bg-[#F5F5F0] rounded-lg p-6">
        <h3 className="font-semibold text-[#2D3436] mb-2">Vill du vara först med Legal Source Genie?</h3>
        <p className="text-sm text-gray-600 mb-4">
          AI-driven juridisk research, anpassad för svenska rättskällor.
          Lämna din e-post så meddelar vi dig vid lansering.
        </p>
        <form
          className="flex gap-3"
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault()
            const input = (e.target as HTMLFormElement).elements.namedItem('email') as HTMLInputElement
            alert(`Tack! Vi meddelar ${input.value} vid lansering.`)
            input.value = ''
          }}
        >
          <input
            type="email"
            name="email"
            placeholder="din@email.se"
            required
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3436]/20"
          />
          <button
            type="submit"
            className="bg-[#2D3436] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#3d4446] transition-colors"
          >
            Bevaka
          </button>
        </form>
      </div>

      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onBankId={handleBankId}
        currentLevel={trustLevel}
      />
    </div>
  )
}
