import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { orgNumber } = await req.json()

    if (!orgNumber) {
      return new Response(
        JSON.stringify({ error: 'orgNumber required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validera format: XXXXXX-XXXX eller XXXXXXXXXX
    const cleaned = orgNumber.replace('-', '')
    if (!/^\d{10}$/.test(cleaned)) {
      return new Response(
        JSON.stringify({ error: 'Invalid org number format. Expected XXXXXX-XXXX' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const roaringApiKey = Deno.env.get('ROARING_API_KEY')

    if (!roaringApiKey) {
      // Fallback: returnera mock-data under utveckling
      return new Response(
        JSON.stringify({
          orgNumber: cleaned,
          companyName: `Testbolag ${cleaned}`,
          status: 'mock',
          message: 'ROARING_API_KEY not configured — returning mock data',
          data: {
            name: `Testbolag ${cleaned}`,
            orgNumber: cleaned,
            registrationDate: '2024-01-15',
            address: { city: 'Stockholm', zipCode: '111 22' },
            sniCode: '62010',
            sniDescription: 'Dataprogrammering',
            companyForm: 'AB',
            status: 'Aktivt',
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Roaring.io API-anrop (Steg 1: overview-endpoint)
    const formatted = `${cleaned.substring(0, 6)}-${cleaned.substring(6)}`
    const response = await fetch(
      `https://api.roaring.io/se/company/overview/2.0/${formatted}`,
      {
        headers: {
          'Authorization': `Bearer ${roaringApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      return new Response(
        JSON.stringify({ error: `Roaring API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const companyData = await response.json()

    return new Response(
      JSON.stringify({ orgNumber: cleaned, data: companyData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
