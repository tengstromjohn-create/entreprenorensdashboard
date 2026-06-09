import { useState, useCallback, useEffect } from 'react'
import { callEdgeFunction } from '@/lib/edge-functions'

export interface OverviewContract {
  id: string
  created_at: string
  contract_type: 'nda' | 'employment'
  title: string | null
  status: string
  company_name: string | null
  org_number: string | null
}

export interface OverviewHealthCheck {
  id: string
  created_at: string
  org_number: string
  score: number
  review_status: string
  // deno-irrelevant: analysstrukturen
  analysis: {
    total_color?: 'green' | 'yellow' | 'red'
    areas?: { name: string; score: number; color: string }[]
    top_3_actions?: { action: string; area: string; link_to_tool: string | null }[]
  }
}

export interface CompanyOverview {
  latestHealthCheck: OverviewHealthCheck | null
  contracts: OverviewContract[]
}

export function useCompanyOverview(userId: string | undefined, orgNumber?: string) {
  const [overview, setOverview] = useState<CompanyOverview | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const res = await callEdgeFunction<CompanyOverview>('get-company-overview', {
        userId,
        ...(orgNumber && { orgNumber }),
      })
      setOverview(res)
    } catch (err) {
      console.error('[useCompanyOverview] misslyckades:', err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [userId, orgNumber])

  useEffect(() => {
    load()
  }, [load])

  return { overview, loading, reload: load }
}
