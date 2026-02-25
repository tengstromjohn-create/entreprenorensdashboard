import { getAdminClient } from './supabase-admin.ts'

// ============================================================
// CLAUDE QA SYSTEMPROMPT
// ============================================================
const CLAUDE_QA_SYSTEM_PROMPT = `Du är kvalitetsgranskare för Entreprenörens Dashboard (app.johntengstrom.se).

Din uppgift är att granska AI-genererade rapporter innan de levereras till användare.
Rapporterna genereras av Gemini och handlar om svensk bolagsjuridik och entreprenörskap.

John Tengström är advokat/partner vid ASTRA ADVOKATER med 30 års erfarenhet.
Rapporterna ska reflektera hans expertis — inte generisk AI-text.

GRANSKA FÖLJANDE DIMENSIONER:

1. JURIDISK KORREKTHET
   - Stämmer fakta om svensk bolagsrätt? (ABL, FL, ÅRL)
   - Är tröskelvärden korrekta? (t.ex. revisorsplikt: 3 av 3 anställda/1.5M omsättning/1.5M balans)
   - Är rekommendationer juridiskt sunda?

2. HALLUCINERINGSRISK
   - Finns påståenden som inte stöds av indata?
   - Hittas på företagsnamn, personer, eller lagar som inte existerar?
   - Är siffror och procentsatser rimliga?

3. RELEVANS OCH SPECIFICITET
   - Är analysen specifik för DETTA bolag, eller generisk?
   - Matchar rekommendationer den data som lämnats?
   - Saknas uppenbara observationer baserat på indata?

4. TON OCH JOHNS PERSPEKTIV
   - Låter det som en erfaren advokat och entreprenör?
   - Är det professionellt men tillgängligt?
   - Undviker det AI-klichéer ("i dagens snabbrörliga värld" etc.)?

5. SVENSK KONTEXT
   - Är alla referenser svenska (inte amerikanska/brittiska)?
   - Används korrekt svensk terminologi?
   - Stämmer hänvisningar till myndigheter (Bolagsverket, Skatteverket)?

6. STRUKTURELL INTEGRITET
   - Är JSON-strukturen komplett enligt schema?
   - Finns alla obligatoriska fält?
   - Är poängsättning (0-100) rimlig givet observationerna?

SVARA MED DENNA JSON-STRUKTUR:
{
  "verdict": "approve" | "flag" | "correct",
  "confidence": 0.00-1.00,
  "issues": [
    {
      "category": "legal_accuracy" | "hallucination" | "tone" | "missing_info" | "wrong_recommendation" | "structural" | "swedish_context",
      "severity": "critical" | "warning" | "minor",
      "location": "string — var i rapporten problemet finns",
      "description": "string — vad som är fel",
      "suggested_fix": "string | null — hur det borde vara"
    }
  ],
  "summary": "string — sammanfattning på 1-2 meningar",
  "corrected_output": null | { /* korrigerad JSON om verdict=correct */ }
}

BESLUTSREGLER:
- "approve": Inga kritiska eller viktiga problem. Leverera direkt.
- "flag": Minst 1 kritiskt problem ELLER 3+ varningar. Kräver manuell granskning.
- "correct": 1-2 varningar som du kan fixa. Leverera corrected_output.

VID TVEKSAMHET: Flagga hellre än godkänn. Det är bättre att John granskar än att fel levereras.

ENBART JSON, ingen annan text.`

// ============================================================
// PIPELINE-FUNKTION
// ============================================================
interface PipelineInput {
  sourceType: 'health_check' | 'startup_kit'
  sourceId?: string
  userId?: string
  geminiOutput: Record<string, unknown>
  geminiMeta: {
    model: string
    tokensIn?: number
    tokensOut?: number
    latencyMs: number
  }
}

interface PipelineResult {
  finalOutput: Record<string, unknown>
  qaStatus: string
  qaReviewId: string
  wasAutoDelivered: boolean
}

export async function runQAPipeline(input: PipelineInput): Promise<PipelineResult> {
  const admin = getAdminClient()
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  const startTime = Date.now()

  // Skapa QA-review-post direkt (pending)
  const { data: review, error: insertError } = await admin
    .from('ai_qa_reviews')
    .insert({
      source_type: input.sourceType,
      source_id: input.sourceId || null,
      user_id: input.userId || null,
      gemini_output: input.geminiOutput,
      gemini_model: input.geminiMeta.model,
      gemini_tokens_in: input.geminiMeta.tokensIn || null,
      gemini_tokens_out: input.geminiMeta.tokensOut || null,
      gemini_latency_ms: input.geminiMeta.latencyMs,
      qa_status: 'pending',
    })
    .select('id')
    .single()

  if (insertError) throw insertError
  const reviewId = review.id

  // Om ingen Anthropic-nyckel: godkänn direkt (dev-läge)
  if (!anthropicKey) {
    await admin
      .from('ai_qa_reviews')
      .update({
        qa_status: 'approved',
        qa_verdict: { verdict: 'approve', note: 'No ANTHROPIC_API_KEY — auto-approved (dev mode)' },
        qa_confidence_score: 0,
        final_output: input.geminiOutput,
        delivered_at: new Date().toISOString(),
      })
      .eq('id', reviewId)

    return {
      finalOutput: input.geminiOutput,
      qaStatus: 'approved',
      qaReviewId: reviewId,
      wasAutoDelivered: true,
    }
  }

  // Steg 2: Claude QA
  try {
    const qaResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: CLAUDE_QA_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Granska denna ${input.sourceType === 'health_check' ? 'Corporate Health Check' : 'Startup Kit'}-rapport:\n\n${JSON.stringify(input.geminiOutput, null, 2)}`
        }],
      }),
    })

    if (!qaResponse.ok) {
      throw new Error(`Claude API error: ${qaResponse.status}`)
    }

    const qaData = await qaResponse.json()
    const qaLatencyMs = Date.now() - startTime
    const qaText = qaData.content?.[0]?.text || '{}'
    const qaVerdict = JSON.parse(qaText)

    // Bestäm status och output baserat på verdict
    let qaStatus: string
    let finalOutput: Record<string, unknown>
    let deliveredAt: string | null = null

    switch (qaVerdict.verdict) {
      case 'approve':
        qaStatus = 'approved'
        finalOutput = input.geminiOutput
        deliveredAt = new Date().toISOString()
        break

      case 'correct':
        qaStatus = 'corrected'
        finalOutput = qaVerdict.corrected_output || input.geminiOutput
        deliveredAt = new Date().toISOString()
        break

      case 'flag':
      default:
        qaStatus = 'flagged'
        finalOutput = input.geminiOutput // Sparas men levereras inte
        break
    }

    // Extrahera issue-kategorier
    const issueCategories = [...new Set(
      (qaVerdict.issues || []).map((i: { category: string }) => i.category)
    )]

    // Uppdatera QA-review
    await admin
      .from('ai_qa_reviews')
      .update({
        qa_status: qaStatus,
        qa_verdict: qaVerdict,
        qa_issues: qaVerdict.issues || [],
        qa_confidence_score: qaVerdict.confidence || 0,
        qa_model: 'claude-sonnet-4-20250514',
        qa_tokens_in: qaData.usage?.input_tokens || null,
        qa_tokens_out: qaData.usage?.output_tokens || null,
        qa_latency_ms: qaLatencyMs,
        final_output: finalOutput,
        delivered_at: deliveredAt,
        issue_categories: issueCategories,
      })
      .eq('id', reviewId)

    return {
      finalOutput,
      qaStatus,
      qaReviewId: reviewId,
      wasAutoDelivered: qaStatus !== 'flagged',
    }

  } catch (qaError) {
    // Om Claude QA misslyckas: godkänn Gemini-output med notering
    // Bättre att leverera ogranskad output än ingen alls
    console.error('Claude QA failed:', qaError)

    await admin
      .from('ai_qa_reviews')
      .update({
        qa_status: 'approved',
        qa_verdict: {
          verdict: 'approve',
          note: `QA failed: ${qaError.message}. Auto-approved as fallback.`,
        },
        qa_confidence_score: 0,
        final_output: input.geminiOutput,
        delivered_at: new Date().toISOString(),
      })
      .eq('id', reviewId)

    return {
      finalOutput: input.geminiOutput,
      qaStatus: 'approved',
      qaReviewId: reviewId,
      wasAutoDelivered: true,
    }
  }
}

// ============================================================
// FLAGGAD-RAPPORT: Vad användaren ser vid flaggning
// ============================================================
export function getFlaggedUserResponse(sourceType: string) {
  if (sourceType === 'health_check') {
    return {
      status: 'review_pending',
      message: 'Din Corporate Health Check bearbetas och kvalitetssäkras. Du får resultatet inom kort.',
      estimated_time: '1-2 timmar under kontorstid',
      contact: 'Vid frågor, boka ett samtal på johntengstrom.se/boka',
    }
  }
  return {
    status: 'review_pending',
    message: 'Din Startup Kit-rapport genomgår kvalitetskontroll. Du får den inom kort.',
    estimated_time: '1-2 timmar under kontorstid',
    contact: 'Vid frågor, boka ett samtal på johntengstrom.se/boka',
  }
}
