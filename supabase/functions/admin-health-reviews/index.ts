import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

/**
 * admin-health-reviews (2026-06-08) — juristens rättningsverktyg för Health Check.
 *
 * Skyddas av ADMIN_SECRET (Supabase secret). Frontend håller aldrig secreten i bundlen —
 * juristen anger den i admin-vyn och den lagras i sessionStorage under sessionen.
 *
 * Actions (POST body): 'list' | 'get' | 'save'
 *   list → senaste analyserna med status
 *   get  → full analys (corrected_analysis om den finns, annars analysis)
 *   save → spara juristens korrigering, sätt review_status='lawyer_reviewed'
 */

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const body = await req.json()
    const { action, adminSecret } = body

    const expected = Deno.env.get('ADMIN_SECRET')
    if (!expected || adminSecret !== expected) {
      return new Response(
        JSON.stringify({ error: 'Obehörig — fel eller saknad admin-nyckel' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const admin = getAdminClient()

    if (action === 'list') {
      const { data, error } = await admin
        .from('health_check_results')
        .select('id, created_at, org_number, company_data, score, review_status, analysis')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      // deno-lint-ignore no-explicit-any
      const items = (data ?? []).map((r: any) => ({
        id: r.id,
        created_at: r.created_at,
        org_number: r.org_number,
        company_name: r.company_data?.name ?? r.analysis?.company_name ?? 'Okänt bolag',
        score: r.score,
        review_status: r.review_status,
        total_color: r.analysis?.total_color ?? null,
      }))
      return new Response(JSON.stringify({ items }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'get') {
      const { id } = body
      if (!id) throw new Error('id krävs')
      const { data, error } = await admin
        .from('health_check_results')
        .select('id, created_at, org_number, company_data, analysis, corrected_analysis, review_status, reviewed_by, reviewed_at, review_note')
        .eq('id', id)
        .single()
      if (error) throw error
      return new Response(
        JSON.stringify({
          ...data,
          // corrected_analysis är kanonisk om den finns
          effective_analysis: data.corrected_analysis ?? data.analysis,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'save') {
      const { id, correctedAnalysis, reviewedBy, reviewNote } = body
      if (!id || !correctedAnalysis) throw new Error('id och correctedAnalysis krävs')
      const { error } = await admin
        .from('health_check_results')
        .update({
          corrected_analysis: correctedAnalysis,
          score: correctedAnalysis.total_score ?? null,
          areas: correctedAnalysis.areas ?? null,
          review_status: 'lawyer_reviewed',
          reviewed_by: reviewedBy || 'Okänd jurist',
          reviewed_at: new Date().toISOString(),
          review_note: reviewNote || null,
        })
        .eq('id', id)
      if (error) throw error
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(
      JSON.stringify({ error: `Okänd action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
