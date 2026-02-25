import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { email } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'email required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const admin = getAdminClient()

    // Sök i client_registry
    const { data: client, error } = await admin
      .from('client_registry')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single()

    if (error || !client) {
      return new Response(
        JSON.stringify({ found: false, message: 'No active client found with this email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Skicka magic link via Supabase Auth
    const { error: magicLinkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase(),
      options: {
        redirectTo: `${Deno.env.get('SITE_URL') || 'https://app.johntengstrom.se'}/auth/callback`,
      },
    })

    if (magicLinkError) {
      throw magicLinkError
    }

    // TODO: Skicka SMS OTP via Twilio om client.phone finns
    // const twilioSid = Deno.env.get('TWILIO_SID')
    // const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')

    return new Response(
      JSON.stringify({
        found: true,
        clientName: client.name,
        hasPhone: !!client.phone,
        message: 'Magic link sent. Check your email.',
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
