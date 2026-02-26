import { useState, useCallback } from 'react'
import { callEdgeFunction } from '@/lib/edge-functions'
import { supabase } from '@/lib/supabase'
import type { CompanyData } from '@/types/dashboard'

export function useCompanyData(userId: string | undefined) {
  const [companyData, setCompanyData] = useState<CompanyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchFromProfile = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const { data, error: dbError } = await supabase
        .from('user_profiles')
        .select('company_data, company_name, org_number')
        .eq('id', userId)
        .single()
      if (dbError) throw dbError
      if (data?.company_data) {
        setCompanyData(data.company_data as CompanyData)
      } else if (data?.org_number) {
        setCompanyData({
          name: data.company_name || 'Okänt bolag',
          orgNumber: data.org_number,
        })
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [userId])

  const refreshCompanyData = useCallback(async (orgNumber: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await callEdgeFunction<{ orgNumber: string; data: CompanyData }>('lookup-company', {
        orgNumber,
      })
      setCompanyData(result.data)
      return result.data
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { companyData, loading, error, fetchFromProfile, refreshCompanyData }
}
