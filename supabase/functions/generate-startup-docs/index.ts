import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

const STARTUP_KIT_PROMPT = `Du är John Tengström, advokat och partner vid ASTRA ADVOKATER i Stockholm med 30 års erfarenhet som entreprenör, styrelseledamot, reservofficer och jurist.

En entreprenör har köpt Startup Kit (1 490 kr) och fyllt i ett situationsformulär. Du ska generera en skräddarsydd rapport med situationsanalys, rekommendationer och en 90-dagars handlingsplan.

Ingen entreprenör får samma output. Varje rapport är unik baserad på deras specifika situation.

ENTREPRENÖRENS SITUATION:

{{situation_data}}

BOLAGSDATA FRÅN BOLAGSVERKET (om tillgängligt):

{{company_data}}

VERIFIERINGSSPÅR: {{track}}

(bankid = full AI-analys med Johns perspektiv | manual = förenklad checklista)

OM track === "bankid":

Generera en komplett rapport baserad på entreprenörens situation. Tänk som en erfaren advokat och entreprenör som sitter mitt emot personen och ger dem rak, handlingsbar rådgivning.

ANALYSERA DESSA DIMENSIONER:

1. GRUNDARSITUATION — Antal grundare, roller, kompetenser, risker vid sårbarhet

2. BOLAGSFORM & STRUKTUR — Rätt bolagsform? Ägarstruktur? Holding?

3. KAPITAL & FINANSIERING — Aktiekapital, bootstrapping vs extern, options/incitament

4. IP & TILLGÅNGAR — Vem äger IP? Patent, varumärke, domäner, källkod

5. AVTAL & DOKUMENTATION — Aktieägaravtal, bolagsordning, kundavtal, anställningsavtal

6. REGULATORISKT & COMPLIANCE — Branschspecifika krav, GDPR, AML, tillstånd

REGLER:
- Var SPECIFIK för deras situation — använd namn, belopp, bransch
- Förklara VARFÖR varje rekommendation är viktig
- Inkludera KONSEKVENSER av att inte följa rådet
- 90-dagarsplanen ska vara REALISTISK för en entreprenör som också driver sin verksamhet
- Månad 1 = kritiska grundläggande åtgärder
- Månad 2 = strukturella förbättringar
- Månad 3 = strategisk positionering och framtidssäkring
- Varje uppgift ska vara konkret och genomförbar (inte "fundera på" utan "skriv/skapa/boka")
- Svenska, professionellt men tillgängligt
- Johns perspektiv = personlig reflektion som ger extra insikt utöver det rent juridiska

SVARA ENBART MED DENNA JSON-STRUKTUR:

{
  "entrepreneur_name": "string",
  "company_name": "string | null",
  "report_date": "YYYY-MM-DD",
  "situation_analysis": {
    "summary": "string (2–3 meningar som sammanfattar helheten)",
    "key_observations": [
      {
        "area": "string",
        "observation": "string",
        "risk_level": "critical | moderate | low"
      }
    ],
    "johns_perspective": "string (personlig reflektion, 3–4 meningar)"
  },
  "recommendations": [
    {
      "title": "string",
      "description": "string",
      "priority": "critical | important | nice_to_have",
      "consequence_if_skipped": "string",
      "requires_external_help": boolean,
      "external_help_type": "lawyer | accountant | patent_agent | none"
    }
  ],
  "action_plan": {
    "month_1": [
      {
        "week": "1–2 | 3–4",
        "task": "string",
        "details": "string",
        "priority": "critical | important",
        "deliverable": "string (vad ska vara klart?)"
      }
    ],
    "month_2": [...],
    "month_3": [...]
  },
  "documents_to_create": [
    {
      "document": "string",
      "why": "string",
      "template_available": boolean
    }
  ],
  "next_step_cta": {
    "message": "string",
    "suggested_product": "platform | inner_circle | book_call"
  }
}

OM track === "manual":

Generera en förenklad checklista för entreprenörer som inte verifierat sin identitet.

SVARA ENBART MED DENNA JSON-STRUKTUR:

{
  "checklist_title": "Dina första steg för att starta aktiebolag",
  "steps": [
    {
      "step": "string",
      "description": "string",
      "link": "string | null"
    }
  ],
  "upgrade_message": "För en skräddarsydd analys av just din situation, verifiera med BankID för att låsa upp den fullständiga rapporten.",
  "disclaimer": "Denna information är allmän vägledning, inte juridisk rådgivning. För juridisk rådgivning, boka ett samtal med John."
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
    const { sessionId, userId, formData, companyData, trustLevel } = await req.json()

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

    const verificationTrack = trustLevel === 'bankid' ? 'bankid' : 'manual'

    const systemPrompt = STARTUP_KIT_PROMPT
      .replace('{{situation_data}}', JSON.stringify(sanitizeObject(formData), null, 2))
      .replace('{{company_data}}', companyData ? JSON.stringify(companyData, null, 2) : 'Ej tillgängligt')
      .replace('{{track}}', verificationTrack)

    const callGemini = async () => {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
            generationConfig: {
              temperature: 0.4,
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

    let report: Record<string, unknown>
    try {
      const result = await callGemini()
      report = JSON.parse(result || '{}')
    } catch {
      const retry = await callGemini()
      try {
        report = JSON.parse(retry || '{}')
      } catch {
        // Uppdatera session till failed
        if (sessionId) {
          await admin
            .from('startup_kit_sessions')
            .update({ status: 'failed' })
            .eq('id', sessionId)
        }
        return new Response(
          JSON.stringify({ error: true, message: 'Analysen kunde inte genereras. Försök igen.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Spara genererat resultat
    if (sessionId) {
      await admin
        .from('startup_kit_sessions')
        .update({
          generated_report: report,
          status: 'completed',
        })
        .eq('id', sessionId)
    }

    return new Response(
      JSON.stringify({ sessionId, report }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
