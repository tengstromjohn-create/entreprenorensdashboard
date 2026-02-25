import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { orgNumber, companyData, surveyAnswers, trustLevel, userId } = await req.json()

    if (!orgNumber || !surveyAnswers) {
      return new Response(
        JSON.stringify({ error: 'orgNumber and surveyAnswers required' }),
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

    // Anpassa systemprompt baserat på trust level
    // TODO: Byt till fullständig systemprompt från gemini-systemprompts-health-check-startup-kit.docx
    const isBasicAccess = trustLevel === 'org_nr'

    const systemPrompt = isBasicAccess
      ? `Du är Corporate Health Check-assistenten för johntengstrom.se.
Användaren har BEGRÄNSAD tillgång (org_nr-spår, ej BankID-verifierad).
Ge en ENKLARE analys med generella tips. Nämn att fullständig analys kräver BankID-verifiering.
Analysera bolaget baserat på enkätsvar och bolagsdata.
Svara på svenska. Returnera JSON med: score (0-100), areas (array med {name, status, recommendation}), summary.`
      : `Du är Corporate Health Check-assistenten för johntengstrom.se.
Användaren är BankID-VERIFIERAD — ge FULL AI-analys med Johns perspektiv.
Inkludera specifika juridiska observationer, riskbedömning, och åtgärdsförslag.
Analysera bolaget på djupet baserat på enkätsvar och bolagsdata.
Svara på svenska. Returnera JSON med: score (0-100), areas (array med {name, status, recommendation, details}), summary, keyRisks, nextSteps.`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{
            parts: [{
              text: JSON.stringify({
                orgNumber,
                companyData: companyData || {},
                surveyAnswers,
                trustLevel,
              })
            }]
          }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    )

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status}`)
    }

    const geminiData = await geminiResponse.json()
    const analysisText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    const analysis = JSON.parse(analysisText || '{}')

    // Spara i health_check_results
    if (userId) {
      await admin.from('health_check_results').insert({
        user_id: userId,
        org_number: orgNumber,
        company_data: companyData || {},
        analysis,
        score: analysis.score || 0,
        areas: analysis.areas || [],
      })
    }

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
