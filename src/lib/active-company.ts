import type { CompanyData, EngagementData } from '../types/dashboard.ts'

const storageKey = 'grundat_active_company'
type CompanyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function readActiveCompany(storage: CompanyStorage, userId: string | undefined): CompanyData | null {
  try {
    const stored = storage.getItem(storageKey)
    if (!stored) return null
    const selection: { userId?: string; company?: CompanyData } | null = JSON.parse(stored)
    if (userId && selection?.userId === userId && selection.company) return selection.company
    storage.removeItem(storageKey)
  } catch {
    // Bolagsvalet kan användas i minnet när sessionStorage är otillgänglig.
  }
  return null
}

export function storeActiveCompany(storage: CompanyStorage, userId: string, company: CompanyData | null) {
  try {
    if (company) storage.setItem(storageKey, JSON.stringify({ userId, company }))
    else storage.removeItem(storageKey)
  } catch {
    // Bolagsvalet kan användas i minnet när sessionStorage är otillgänglig.
  }
}

export function getCompanyPrefill(activeCompany: CompanyData | null, engagement?: EngagementData['items'][number]) {
  return {
    name: activeCompany?.name ?? engagement?.companyName ?? '',
    orgNumber: activeCompany?.orgNumber ?? engagement?.orgNumber ?? '',
    address: activeCompany?.address ?? '',
  }
}
