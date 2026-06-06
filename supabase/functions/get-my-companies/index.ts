import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getRoaringCredentials, getRoaringToken, fetchEngagements } from '../_shared/roaring.ts'

/**
 * get-my-companies (Spurt A2, 2026-06-05)
 *
 * Tar personnummer → returnerar bolag personen företräder (styrelseuppdrag m.m.)
 * via Roaring Company Engagements 3.0. Revisorsroller exkluderas.
 *
 * Säkerhet: personnumret används enbart för Roaring-anropet och returneras/
 * lagras ALDRIG av denna funktion. Engagement-listan (orgnr + bolagsnamn + roll)
 * är publik information från Bolagsverket.
 *
 * Mock-fallback när ROARING_CLIENT_ID/SECRET saknas — samma mönster som lookup-company.
 */

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { personalNumber } = await req.json()

    if (!personalNumber) {
      return new Response(
        JSON.stringify({ error: 'personalNumber required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalisera: ÅÅÅÅMMDDXXXX (12 siffror). Acceptera även ÅÅMMDD-XXXX (10).
    const cleaned = String(personalNumber).replace(/[-\s]/g, '')
    if (!/^\d{10}$|^\d{12}$/.test(cleaned)) {
      return new Response(
        JSON.stringify({ error: 'Invalid personal number format. Expected YYYYMMDDXXXX or YYMMDD-XXXX' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const creds = getRoaringCredentials()

    if (!creds) {
      return new Response(
        JSON.stringify({
          source: 'mock',
          message: 'ROARING_CLIENT_ID / ROARING_CLIENT_SECRET not configured — returning mock data',
          data: {
            fetchedAt: new Date().toISOString(),
            source: 'roaring',
            fullName: 'Test Testsson',
            items: [
              { orgNumber: '5561234567', companyName: 'Testbolaget i Stockholm AB', roles: ['Ledamot', 'Verkställande direktör'] },
              { orgNumber: '5569876543', companyName: 'Andra Bolaget AB', roles: ['Suppleant'] },
            ],
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = await getRoaringToken(creds.clientId, creds.clientSecret)
    const result = await fetchEngagements(token, cleaned)

    if (!result.ok) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ source: 'roaring', data: result.data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
