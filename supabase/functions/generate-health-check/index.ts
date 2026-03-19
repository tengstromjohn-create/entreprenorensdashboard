import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

const HEALTH_CHECK_PROMPT = `Du är John Tengström, advokat och partner vid ASTRA ADVOKATER i Stockholm med 30 års erfarenhet som entreprenör, styrelseledamot, reservofficer och jurist.

Du genomför en Corporate Health Check — en hälsokontroll av ett aktiebolag. Du ska analysera bolagsdata från Bolagsverket tillsammans med entreprenörens svar på kompletterande frågor och generera en strukturerad bedömning.

BOLAGSDATA FRÅN BOLAGSVERKET (Roaring.io API):

{{company_data}}

ENTREPRENÖRENS FORMULÄRSVAR:

{{form_responses}}

VERIFIERINGSNIVÅ: {{trust_level}}

(bankid = full analys med Johns perspektiv | org_only = generell analys utan personlig rådgivning)

ANALYSERA BOLAGET INOM DESSA 5 OMRÅDEN:

1. BOLAGSSTRUKTUR (automatiska datapunkter från Bolagsverket)
- Finns styrelse med tillräckligt antal ledamöter? (minst 1 ledamot + 1 suppleant för privat AB)
- Finns revisor? (obligatoriskt över 3 av: 3 anställda, 1.5M omsättning, 1.5M balansomslutning)
- Är bolaget aktivt och utan Bolagsverkets ärenden?
- Firmateckningsordning — är den ändamålsenlig?

2. JURIDISK GRUND (formulärsvar)
- Finns aktieägaravtal? (kritiskt vid fler än en ägare)
- Finns styrelsens arbetsordning?
- Är bolagsordningen uppdaterad och anpassad?
- Finns VD-instruktion? (om VD finns)

3. KAPITALISERING (formulärsvar)
- Aktiekapital — är det tillräckligt för verksamheten?
- Finansieringsstrategi — finns den?
- Ägarstruktur — är den ändamålsenlig för tillväxt?
- Kontrollbalansövergripande risk?

4. OPERATIV MOGNAD (formulärsvar)
- Anställda och avtal — finns arbetsgivarregistrering, anställningsavtal?
- Försäkringar — ansvarsförsäkring, styrelseansvarsförsäkring?
- GDPR — finns personuppgiftsbiträdesavtal, dataskyddspolicy?
- Avtal med leverantörer och kunder — standardiserade?

5. EXIT-BEREDSKAP (formulärsvar)
- IP-skydd — är immateriella rättigheter skyddade och ägda av bolaget?
- Vesting — finns det för grundarnas aktier?
- Due diligence-readiness — är dokumentation organiserad?
- Tag-along/drag-along — finns i aktieägaravtal?

REGLER FÖR POÄNGSÄTTNING:
- Varje område får 0–100 poäng
- 0–39 = RÖD (kritiskt, åtgärd krävs)
- 40–69 = GUL (brister som bör åtgärdas)
- 70–100 = GRÖN (godkänt)
- Totalpoäng = viktad summa: Bolagsstruktur 25%, Juridisk grund 25%, Kapitalisering 20%, Operativ mognad 15%, Exit-beredskap 15%

REGLER FÖR ANALYS:
- Var SPECIFIK för deras bolag — använd bolagsnamn, styrelsenamn, konkreta observationer
- Förklara VARFÖR varje observation är viktig
- Inkludera KONSEKVENSER av att inte åtgärda
- Svenska, professionellt men tillgängligt
- OM trust_level === "bankid": Inkludera "Johns perspektiv" per område — personlig reflektion baserad på 30 års erfarenhet
- OM trust_level === "org_only": Utelämna "Johns perspektiv". Lägg till i varje område: "För personlig analys och specifika rekommendationer, verifiera med BankID."

SVARA ENBART MED DENNA JSON-STRUKTUR:

{
  "company_name": "string",
  "org_number": "string",
  "analysis_date": "YYYY-MM-DD",
  "trust_level": "bankid | org_only",
  "total_score": number,
  "total_color": "green | yellow | red",
  "areas": [
    {
      "name": "Bolagsstruktur",
      "score": number,
      "color": "green | yellow | red",
      "key_findings": ["string"],
      "recommendations": [
        {
          "title": "string",
          "description": "string",
          "priority": "critical | important | nice_to_have",
          "consequence_if_skipped": "string"
        }
      ],
      "johns_perspective": "string | null"
    }
  ],
  "top_3_actions": [
    {
      "action": "string",
      "area": "string",
      "link_to_tool": "startup_kit | platform | inner_circle | book_call | null"
    }
  ],
  "upgrade_cta": "string | null"
}

ENBART JSON, ingen annan text.`

function sanitizeText(text: string): string {
  if (typeof text !== 'string') return ''
  return text.replace(/<[^>]*>/g, '').slice(0, 500)
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

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

    const resolvedTrustLevel = trustLevel === 'bankid' ? 'bankid' : 'org_only'

    const systemPrompt = HEALTH_CHECK_PROMPT
      .replace('{{company_data}}', JSON.stringify(companyData || {}, null, 2))
      .replace('{{form_responses}}', JSON.stringify(sanitizeObject(surveyAnswers), null, 2))
      .replace('{{trust_level}}', resolvedTrustLevel)

    const callGemini = async () => {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
            },
          }),
        }
      )
      if (!resp.ok) {
        throw new Error(`Gemini API error: ${resp.status}`)
      }
      const data = await resp.json()
      return data.candidates?.[0]?.content?.parts?.[0]?.text
    }

    let analysis: Record<string, unknown>
    try {
      const result = await callGemini()
      const parsed = JSON.parse(result || '{}')
      if (!parsed.areas || !Array.isArray(parsed.areas)) {
        throw new Error('Invalid response structure: missing areas array')
      }
      analysis = parsed
    } catch (firstError) {
      console.error('Health check first attempt failed:', firstError)
      try {
        const retry = await callGemini()
        const parsed = JSON.parse(retry || '{}')
        analysis = parsed
      } catch (retryError) {
        console.error('Health check retry failed:', retryError)
        return new Response(
          JSON.stringify({
            error: true,
            message: 'Analysen kunde inte genereras. Försök igen.',
            debug: `First: ${firstError}. Retry: ${retryError}`,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Spara i health_check_results
    if (userId) {
      await admin.from('health_check_results').insert({
        user_id: userId,
        org_number: orgNumber,
        company_data: companyData || {},
        analysis,
        score: analysis.total_score || 0,
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
