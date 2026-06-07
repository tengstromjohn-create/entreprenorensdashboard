import { useState, useCallback } from 'react'
import { callEdgeFunction } from '@/lib/edge-functions'
import { supabase } from '@/lib/supabase'
import type { CompanyData } from '@/types/dashboard'

// Extrahera ett läsbart meddelande från Error ELLER plain-object-fel som
// PostgrestError ({ message, details, hint, code }) — annars blev allt "Unknown error".
function errMessage(err: unknown, fallback = 'Något gick fel'): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message: unknown }).message
    if (typeof m === 'string' && m) return m
  }
  return fallback
}

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
        .maybeSingle() // 0 rader -> data null (inget fel); behåll throw för riktiga fel
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
      setError(errMessage(err))
    } finally {
      setLoading(false)
    }
  }, [userId])

  const refreshCompanyData = useCallback(async (orgNumber: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await callEdgeFunction<{ orgNumber: string; found?: boolean; data?: CompanyData; message?: string }>('lookup-company', {
        orgNumber,
      })
      if (result.found === false || !result.data) {
        setError(`Inget bolag hittades för ${orgNumber}.`)
        return null
      }
      setCompanyData(result.data)
      return result.data
    } catch (err: unknown) {
      setError(errMessage(err))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { companyData, loading, error, fetchFromProfile, refreshCompanyData }
}
