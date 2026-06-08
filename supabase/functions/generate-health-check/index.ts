import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

/**
 * Corporate Health Check (reviderad bedömningsmall 2026-06-08).
 *
 * Fem områden med vikter:
 *   Bolagsstruktur 20% · Ägande & styrning 25% · Avtal & immateriella tillgångar 20%
 *   · Personal & arbetsrätt 15% · Ekonomi & regelefterlevnad 20%
 *
 * Indata: autohämtad Bolagsverksdata (companyData) + entreprenörens svar (surveyReadable).
 * Output innehåller regulatory_requirements (tom platshållare som Legal Source Genie fyller).
 */

const HEALTH_CHECK_PROMPT = `Du är John Tengström, advokat och partner vid ASTRA ADVOKATER i Stockholm med 30 års erfarenhet som entreprenör, styrelseledamot och jurist.

Du genomför en Corporate Health Check — en juridisk hälso- och riskanalys av ett aktiebolag. Du väger samman autohämtad bolagsdata från Bolagsverket med entreprenörens svar och levererar en strukturerad bedömning som blandar juridisk risk med affärsrisk som har juridisk bäring.

AUTOHÄMTAD BOLAGSDATA (Bolagsverket via Roaring):
{{company_data}}

ENTREPRENÖRENS SVAR (område · fråga · svar):
{{survey_readable}}

VERIFIERINGSNIVÅ: {{trust_level}}
(bankid = full analys med Johns perspektiv | org_only = generell analys utan personlig rådgivning)

BEDÖMNINGSMALL — FEM OMRÅDEN (analysera vart och ett):

1. Bolagsstruktur (vikt 20%)
   Använd autodatan: styrelsens sammansättning (minst 1 ledamot + 1 suppleant för privat AB),
   firmateckning, bolagets status och ärenden hos Bolagsverket. Bedöm om strukturen är
   ändamålsenlig och formellt korrekt.

2. Ägande & styrning (vikt 25%)
   Antal ägare och om aktieägaravtal finns (kritiskt vid fler än en ägare — exit, värdering,
   låsning, dödsfall). Styrelsearbetsordning, anpassad bolagsordning, samt nyckelpersonsberoende
   (vesting, successionsavtal, nyckelpersonsförsäkring). Väg in finansieringsform: externt kapital
   höjer kraven på ägarreglering.

3. Avtal & immateriella tillgångar (vikt 20%)
   Kundavtalens form (skriftliga standardavtal vs muntligt/ad hoc), kundtyp (B2B/B2C/offentlig →
   konsumenträtt, LOU), IP-ägande (äger bolaget kod/varumärke/design, har konsulter/anställda
   överlåtit rättigheter), kritiskt leverantörs-/plattformsberoende, användning av sekretessavtal.

4. Personal & arbetsrätt (vikt 15%)
   Skriftliga anställningsavtal (6 c § LAS), användning av konsulter/frilansare (risk för
   felklassificering och oöverlåten IP), kollektivavtal. Om bolaget saknar anställda: sätt högt
   betyg och notera att området aktualiseras vid första anställning.

5. Ekonomi & regelefterlevnad (vikt 20%)
   Kontrollbalansräkningsrisk (25 kap. ABL), ansvars-/styrelseansvarsförsäkring, GDPR-mognad
   (kalibrera mot mängden personuppgifter — känsliga uppgifter höjer kraven kraftigt),
   tillstånds-/registreringsplikt, samt internationell handel (moms, dataöverföring).

POÄNGSÄTTNING:
- Varje område 0–100. 0–39 = RÖD (kritiskt), 40–69 = GUL (brister), 70–100 = GRÖN (godkänt).
- Totalpoäng = viktad summa enligt vikterna ovan.
- Väg tyngre på svar som signalerar kritisk risk (saknat aktieägaravtal vid flera ägare,
  oöverlåten IP, muntliga kundavtal, kontrollbalansrisk, saknade tillstånd).
- Svar "Vet ej" ska sänka betyget måttligt och generera en rekommendation om att utreda.

REGLER FÖR ANALYS:
- Var SPECIFIK för detta bolag — använd bolagsnamn, styrelsenamn och konkreta svar.
- Förklara VARFÖR varje observation är viktig och KONSEKVENSEN av att inte åtgärda.
- Svenska, professionellt men tillgängligt. Undvik AI-klichéer.
- OM trust_level === "bankid": skriv "johns_perspective" per område — personlig reflektion i jag-form.
- OM trust_level === "org_only": sätt "johns_perspective" till null och lägg i upgrade_cta en uppmaning att verifiera med BankID.
- VAR KONCIS: max 3 key_findings och max 2 recommendations per område. Hela JSON-svaret måste rymmas — trunkerad JSON är värdelös.
- regulatory_requirements ska ALLTID vara en tom array [] i detta skede (fylls senare av Legal Source Genie). Hitta inte på regulatoriska krav.

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
      "name": "Bolagsstruktur | Ägande & styrning | Avtal & immateriella tillgångar | Personal & arbetsrätt | Ekonomi & regelefterlevnad",
      "score": number,
      "color": "green | yellow | red",
      "key_findings": ["string"],
      "recommendations": [
        { "title": "string", "description": "string", "priority": "critical | important | nice_to_have", "consequence_if_skipped": "string" }
      ],
      "johns_perspective": "string | null"
    }
  ],
  "top_3_actions": [
    { "action": "string", "area": "string", "link_to_tool": "startup_kit | platform | inner_circle | book_call | null" }
  ],
  "regulatory_requirements": [],
  "upgrade_cta": "string | null"
}

ENBART JSON, ingen annan text.`

function sanitizeText(text: string): string {
  if (typeof text !== 'string') return ''
  return text.replace(/<[^>]*>/g, '').slice(0, 800)
}

// deno-lint-ignore no-explicit-any
function buildReadable(surveyReadable: any, surveyAnswers: any): string {
  if (Array.isArray(surveyReadable) && surveyReadable.length > 0) {
    return surveyReadable
      .map((r) => `- [${r.area}] ${sanitizeText(r.question)}: ${sanitizeText(r.answer)}`)
      .join('\n')
  }
  // Fallback: råa svar (om en äldre frontend skickar bara surveyAnswers)
  if (surveyAnswers && typeof surveyAnswers === 'object') {
    return Object.entries(surveyAnswers)
      .map(([k, v]) => `- ${k}: ${sanitizeText(String(v))}`)
      .join('\n')
  }
  return '(inga svar lämnade)'
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { orgNumber, companyData, surveyAnswers, surveyReadable, trustLevel, userId } = await req.json()

    if (!orgNumber || (!surveyAnswers && !surveyReadable)) {
      return new Response(
        JSON.stringify({ error: 'orgNumber and survey answers required' }),
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

    // Rensa bort rå-Roaring-payloaden (signatory.raw) — stor och irrelevant för analysen
    // deno-lint-ignore no-explicit-any
    const promptCompanyData: any = companyData ? { ...companyData } : {}
    if (promptCompanyData.signatory?.raw) {
      promptCompanyData.signatory = { ...promptCompanyData.signatory, raw: undefined }
    }
    const sniCode: string | null = promptCompanyData.sniCode || promptCompanyData.industryCode || null

    const systemPrompt = HEALTH_CHECK_PROMPT
      .replace('{{company_data}}', JSON.stringify(promptCompanyData, null, 2))
      .replace('{{survey_readable}}', buildReadable(surveyReadable, surveyAnswers))
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
              // Gemini 2.5 Flash: thinking-tokens räknas in i maxOutputTokens och trunkerade
              // tidigare JSON:en ("Unterminated string"). Stäng av thinking + höj taket.
              maxOutputTokens: 16384,
              thinkingConfig: { thinkingBudget: 0 },
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
        if (!parsed.areas) throw new Error('Invalid retry structure')
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

    // Säkerställ att LSG-platshållaren finns
    if (!Array.isArray(analysis.regulatory_requirements)) {
      analysis.regulatory_requirements = []
    }

    // Spara i health_check_results (review_status='ai_only' tills jurist rättat)
    if (userId) {
      await admin.from('health_check_results').insert({
        user_id: userId,
        org_number: orgNumber,
        company_data: companyData || {},
        analysis,
        score: analysis.total_score || 0,
        areas: analysis.areas || [],
        regulatory_requirements: analysis.regulatory_requirements,
        sni_code: sniCode,
        review_status: 'ai_only',
      })
    }

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
