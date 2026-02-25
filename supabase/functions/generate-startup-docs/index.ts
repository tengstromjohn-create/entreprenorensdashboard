import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { sessionId, userId, formData, trustLevel } = await req.json()

    if (!formData) {
      return new Response(
        JSON.stringify({ error: 'formData required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const admin = getAdminClient()
    const geminiKey = Deno.env.get('GEMINI_API_KEY')

    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Uppdatera session-status till 'generating'
    if (sessionId) {
      await admin
        .from('startup_kit_sessions')
        .update({ status: 'generating' })
        .eq('id', sessionId)
    }

    // Gemini API-anrop med systemprompt från projektfil
    // TODO: Hämta systemprompt från gemini-systemprompts-health-check-startup-kit.docx
    const systemPrompt = `Du är en expert på svensk bolagsbildning och juridik.
Generera en skräddarsydd startchecklista baserad på användarens svar.
Trust level: ${trustLevel || 'org_nr'}
${trustLevel === 'org_nr'
  ? 'Ge en allmän startchecklista (30-40 steg). Inga AI-genererade juridiska dokument.'
  : 'Ge en fullständig analys med Johns perspektiv på svensk bolagsjuridik.'
}
Svara ALLTID på svenska. Returnera JSON-format.`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: JSON.stringify(formData) }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    )

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status}`)
    }

    const geminiData = await geminiResponse.json()
    const report = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    // Spara genererat resultat
    if (sessionId) {
      await admin
        .from('startup_kit_sessions')
        .update({
          generated_report: JSON.parse(report || '{}'),
          status: 'completed',
        })
        .eq('id', sessionId)
    }

    return new Response(
      JSON.stringify({ sessionId, report: JSON.parse(report || '{}') }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
