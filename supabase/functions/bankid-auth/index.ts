import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { name, personalNumber, existingUserId } = await req.json()

    if (!name || !personalNumber) {
      return new Response(
        JSON.stringify({ error: 'name and personalNumber required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const admin = getAdminClient()

    // Hash personnummer (SHA-256)
    const encoder = new TextEncoder()
    const data = encoder.encode(personalNumber)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const personalNumberHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    let userId: string

    if (existingUserId) {
      // Uppgradera befintlig användare till BankID-verifierad
      userId = existingUserId
      const { error: updateError } = await admin
        .from('user_profiles')
        .update({
          trust_level: 'bankid',
          personal_number_hash: personalNumberHash,
          bankid_verified_at: new Date().toISOString(),
          display_name: name,
        })
        .eq('id', userId)

      if (updateError) throw updateError
    } else {
      // Kolla om användare redan finns (matcha på hash)
      const { data: existing } = await admin
        .from('user_profiles')
        .select('id')
        .eq('personal_number_hash', personalNumberHash)
        .single()

      if (existing) {
        userId = existing.id
        await admin
          .from('user_profiles')
          .update({
            trust_level: 'bankid',
            bankid_verified_at: new Date().toISOString(),
            display_name: name,
          })
          .eq('id', userId)
      } else {
        // Skapa ny användare
        const email = `bankid_${personalNumberHash.substring(0, 12)}@placeholder.johntengstrom.se`
        const { data: newUser, error: createError } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { display_name: name, trust_level: 'bankid' },
        })
        if (createError) throw createError
        userId = newUser.user.id

        // Skapa user_profiles
        const { error: profileError } = await admin
          .from('user_profiles')
          .insert({
            id: userId,
            display_name: name,
            email,
            trust_level: 'bankid',
            personal_number_hash: personalNumberHash,
            bankid_verified_at: new Date().toISOString(),
          })
        if (profileError) throw profileError
      }
    }

    // Kör jävskontroll automatiskt
    const { data: conflicts } = await admin
      .from('conflict_check_registry')
      .select('*')
      .eq('is_active', true)
      .or(`personal_number.eq.${personalNumber}`)

    const conflictResult = conflicts && conflicts.length > 0 ? 'flagged' : 'clear'

    // Uppdatera jävsresultat
    await admin
      .from('user_profiles')
      .update({
        conflict_check_result: conflictResult,
        conflict_checked_at: new Date().toISOString(),
      })
      .eq('id', userId)

    return new Response(
      JSON.stringify({ userId, conflictResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
