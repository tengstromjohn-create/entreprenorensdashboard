// Trust levels — ordningen är hierarkin (lägst → högst)
export type TrustLevel = 'org_nr' | 'pending_manual' | 'verified_manual' | 'bankid' | 'existing_client'

// Trust level metadata
export const TRUST_LEVELS: Record<TrustLevel, {
  label: string
  color: string
  bgColor: string
  icon: string
  rank: number
}> = {
  org_nr:           { label: 'Begränsad tillgång',     color: 'text-gray-500',   bgColor: 'bg-gray-100',   icon: 'Shield',       rank: 1 },
  pending_manual:   { label: 'Väntar på verifiering',  color: 'text-amber-600',  bgColor: 'bg-amber-50',   icon: 'Clock',        rank: 2 },
  verified_manual:  { label: 'Verifierad',             color: 'text-blue-600',   bgColor: 'bg-blue-50',    icon: 'ShieldCheck',  rank: 3 },
  bankid:           { label: 'BankID-verifierad',      color: 'text-green-600',  bgColor: 'bg-green-50',   icon: 'ShieldCheck',  rank: 4 },
  existing_client:  { label: 'Klient',                 color: 'text-purple-600', bgColor: 'bg-purple-50',  icon: 'Star',         rank: 5 },
}

export function hasTrustLevel(current: TrustLevel, required: TrustLevel): boolean {
  return TRUST_LEVELS[current].rank >= TRUST_LEVELS[required].rank
}

export interface CompanyData {
  name: string
  orgNumber: string
  registrationDate?: string
  sniCode?: string
  sniDescription?: string
  sede?: string
  address?: string
  boardMembers?: BoardMember[]
  status?: string
  companyType?: string
}

export interface BoardMember {
  name: string
  role: string
  personalNumberHash?: string
}

export interface HealthCheckResult {
  id: string
  created_at: string
  overall_score: number
  areas: HealthCheckArea[]
  recommendations?: string[]
  trust_level_at_check: TrustLevel
}

export interface HealthCheckArea {
  name: string
  status: 'green' | 'yellow' | 'red'
  score: number
  summary: string
}

export interface ToolDefinition {
  id: string
  name: string
  description: string
  icon: string
  price?: string
  route?: string
  externalUrl?: string
  requiredTrust: TrustLevel
  requiresPurchase?: boolean
  productKey?: string
  comingSoon?: boolean
  badge?: string
}

export interface ProductAccess {
  product: string
  source: string
  expires_at?: string
  is_active: boolean
}
