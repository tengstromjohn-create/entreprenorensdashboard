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
    id: 'avtalsmotorn',
    name: 'Avtalsmotorn',
    description: 'Skapa skräddarsydda avtal — NDA och anställningsavtal på minuter',
    icon: 'FileSignature',
    price: 'Gratis',
    route: '/dashboard/verktyg/avtal',
    requiredTrust: 'bankid',
    badge: 'Ny',
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
        <h1 className="text-xl font-bold text-[#0E3047]">Verktyg</h1>
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

      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onBankId={handleBankId}
        currentLevel={trustLevel}
      />
    </div>
  )
}
