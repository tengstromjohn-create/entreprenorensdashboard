import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { HealthCheckResult } from '@/types/dashboard'

export function useHealthCheck(userId: string | undefined) {
  const [latestResult, setLatestResult] = useState<HealthCheckResult | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchLatest = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('health_check_results')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (data) {
        setLatestResult({
          id: data.id,
          created_at: data.created_at,
          overall_score: data.score ?? data.analysis?.score ?? 0,
          areas: data.areas ?? data.analysis?.areas ?? [],
          recommendations: data.analysis?.recommendations,
          trust_level_at_check: data.analysis?.trustLevel || 'org_nr',
        })
      }
    } catch (err) {
      console.error('Failed to fetch health check:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchLatest()
  }, [fetchLatest])

  return { latestResult, loading, refresh: fetchLatest }
}
