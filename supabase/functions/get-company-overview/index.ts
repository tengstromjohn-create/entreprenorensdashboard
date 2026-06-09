import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

/**
 * get-company-overview (2026-06-08) — datakälla för Styrhytten (navet).
 *
 * BankID-användare saknar Supabase-session, så RLS (auth.uid()=id) blockerar
 * klientläsning av health_check_results och contracts. Denna stateless endpoint
 * läser via service role utifrån userId (profile.id från bankid-auth).
 *
 * Returnerar senaste Health Check + användarens avtal (utan tung markdown).
 * Filtreras valfritt på orgNumber.
 */

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { userId, orgNumber } = await req.json()
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const admin = getAdminClient()

    // Senaste Health Check (corrected_analysis är kanonisk om jurist rättat)
    let hcQuery = admin
      .from('health_check_results')
      .select('id, created_at, org_number, score, analysis, corrected_analysis, review_status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
    if (orgNumber) hcQuery = hcQuery.eq('org_number', String(orgNumber).replace('-', ''))
    const { data: hcRows } = await hcQuery
    const hc = hcRows?.[0]
    const latestHealthCheck = hc
      ? {
          id: hc.id,
          created_at: hc.created_at,
          org_number: hc.org_number,
          score: hc.score,
          review_status: hc.review_status,
          analysis: hc.corrected_analysis ?? hc.analysis,
        }
      : null

    // Avtal (utan content_markdown — håll svaret lätt)
    let cQuery = admin
      .from('contracts')
      .select('id, created_at, contract_type, title, status, company_name, org_number')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (orgNumber) cQuery = cQuery.eq('org_number', String(orgNumber).replace('-', ''))
    const { data: contracts } = await cQuery

    return new Response(
      JSON.stringify({ latestHealthCheck, contracts: contracts ?? [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
