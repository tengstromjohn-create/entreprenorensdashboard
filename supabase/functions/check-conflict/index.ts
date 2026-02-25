import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { personalNumberHash, orgNumber, partyNames } = await req.json()

    if (!personalNumberHash && !orgNumber && (!partyNames || partyNames.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'At least one search parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const admin = getAdminClient()

    // Bygg dynamisk sökning mot jävsregistret
    let query = admin
      .from('conflict_check_registry')
      .select('*')
      .eq('is_active', true)

    const conditions: string[] = []
    if (personalNumberHash) {
      conditions.push(`personal_number.eq.${personalNumberHash}`)
    }
    if (orgNumber) {
      conditions.push(`org_number.eq.${orgNumber}`)
    }

    let results: any[] = []

    // Sök på personnummer och orgnummer
    if (conditions.length > 0) {
      const { data } = await admin
        .from('conflict_check_registry')
        .select('*')
        .eq('is_active', true)
        .or(conditions.join(','))
      if (data) results.push(...data)
    }

    // Sök på partnamn (fuzzy)
    if (partyNames && partyNames.length > 0) {
      for (const name of partyNames) {
        const { data } = await admin
          .from('conflict_check_registry')
          .select('*')
          .eq('is_active', true)
          .ilike('party_name', `%${name}%`)
        if (data) results.push(...data)
      }
    }

    // Deduplicera
    const uniqueResults = Array.from(
      new Map(results.map(r => [r.id, r])).values()
    )

    const status = uniqueResults.length > 0 ? 'flagged' : 'clear'

    return new Response(
      JSON.stringify({
        status,
        matchCount: uniqueResults.length,
        matches: uniqueResults.map(r => ({
          id: r.id,
          partyName: r.party_name,
          matterType: r.matter_type,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
