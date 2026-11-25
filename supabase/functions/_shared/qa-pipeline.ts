import { getAdminClient } from './supabase-admin.ts'
import { qaWithClaude, QA_MODEL } from './llm.ts'

// ============================================================
// CLAUDE QA SYSTEMPROMPT
// ============================================================
const CLAUDE_QA_SYSTEM_PROMPT = `Du är kvalitetsgranskare för Entreprenörens Dashboard (grundat.ai).

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
  sourceType: 'health_check' | 'startup_kit' | 'contract'
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

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isQaIssue(value: unknown): value is { category: string } {
  return isObject(value) &&
    typeof value.category === 'string' &&
    ['legal_accuracy', 'hallucination', 'tone', 'missing_info', 'wrong_recommendation', 'structural', 'swedish_context'].includes(value.category) &&
    (value.severity === 'critical' || value.severity === 'warning' || value.severity === 'minor') &&
    typeof value.location === 'string' &&
    typeof value.description === 'string' &&
    (typeof value.suggested_fix === 'string' || value.suggested_fix === null)
}

function parseQaVerdict(text: string | undefined, sourceType: PipelineInput['sourceType']) {
  const response = text?.trim() ?? ''
  const fencedJson = response.match(/^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i)
  let result: unknown
  try {
    result = JSON.parse(fencedJson?.[1] ?? response)
  } catch {
    throw new Error('Claude QA returned invalid JSON')
  }

  if (!isObject(result)) throw new Error('Invalid Claude QA verdict')
  const { verdict, issues, confidence, summary, corrected_output: correctedOutput } = result
  if (
    (verdict !== 'approve' && verdict !== 'correct' && verdict !== 'flag') ||
    !Array.isArray(issues) || !issues.every(isQaIssue) ||
    typeof confidence !== 'number' || confidence < 0 || confidence > 1 ||
    typeof summary !== 'string'
  ) {
    throw new Error('Invalid Claude QA verdict')
  }

  if (verdict === 'correct') {
    if (!isObject(correctedOutput)) throw new Error('Missing Claude QA correction')
    if (sourceType === 'contract' && (
      typeof correctedOutput.title !== 'string' || !correctedOutput.title.trim() ||
      typeof correctedOutput.content_markdown !== 'string' || !correctedOutput.content_markdown.trim()
    )) {
      throw new Error('Invalid Claude QA contract correction')
    }
  } else if (correctedOutput !== null) {
    throw new Error('Unexpected Claude QA correction')
  }

  return { verdict, issues, confidence, correctedOutput, result } as const
}

const QA_CLIENT_ERROR = 'Kvalitetskontrollen misslyckades. Dokumentet kunde inte levereras. Försök igen senare.'
// Avtalsgeneratorn kan skriva 16 384 token. En korrigering behöver även rymma QA-svarets JSON och granskningsanmärkningar.
const CONTRACT_QA_MAX_TOKENS = 32_768

export async function runQAPipeline(input: PipelineInput): Promise<PipelineResult> {
  const admin = getAdminClient()
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

  if (insertError) {
    console.error('Claude QA review insert failed', { code: insertError.code })
    throw new Error(QA_CLIENT_ERROR)
  }
  const reviewId = review.id

  const updateReview = async (fields: Record<string, unknown>) => {
    const { error } = await admin
      .from('ai_qa_reviews')
      .update(fields)
      .eq('id', reviewId)
      .select('id')
      .single()

    if (error) throw new Error(`QA review update failed (${error.code})`)
  }

  // Steg 2: Claude QA
  try {
    const userContent = `Granska denna ${input.sourceType === 'health_check' ? 'Corporate Health Check-rapport' : input.sourceType === 'contract' ? 'avtalsgenerering (granska content_markdown som juridiskt dokument: korrekta lagrum, inga påhittade uppgifter utanför klamrar, tvingande arbetsrätt respekterad)' : 'Startup Kit-rapport'}:\n\n${JSON.stringify(input.geminiOutput, null, 2)}`
    const qa = await qaWithClaude(
      CLAUDE_QA_SYSTEM_PROMPT,
      userContent,
      input.sourceType === 'contract' ? CONTRACT_QA_MAX_TOKENS : undefined,
    )
    const qaVerdict = parseQaVerdict(qa.text, input.sourceType)
    const qaStatus = { approve: 'approved', correct: 'corrected', flag: 'flagged' }[qaVerdict.verdict]
    const finalOutput = qaVerdict.correctedOutput ?? input.geminiOutput
    const wasAutoDelivered = qaVerdict.verdict !== 'flag'

    await updateReview({
      qa_status: qaStatus,
      qa_verdict: qaVerdict.result,
      qa_issues: qaVerdict.issues,
      qa_confidence_score: qaVerdict.confidence,
      qa_model: QA_MODEL,
      qa_tokens_in: qa.tokensIn ?? null,
      qa_tokens_out: qa.tokensOut ?? null,
      qa_latency_ms: Date.now() - startTime,
      final_output: finalOutput,
      delivered_at: wasAutoDelivered ? new Date().toISOString() : null,
      issue_categories: [...new Set(qaVerdict.issues.map((issue) => issue.category))],
    })

    return {
      finalOutput,
      qaStatus,
      qaReviewId: reviewId,
      wasAutoDelivered,
    }

  } catch (qaError) {
    const reason = qaError instanceof Error ? qaError.message : 'Unexpected QA error'
    console.error('Claude QA failed', { reviewId, reason })

    try {
      await updateReview({
        qa_status: 'failed',
        qa_verdict: { verdict: 'failed', note: reason },
        qa_model: QA_MODEL,
        qa_latency_ms: Date.now() - startTime,
        final_output: null,
        delivered_at: null,
      })
    } catch (updateError) {
      console.error('Could not persist failed Claude QA review', { reviewId, updateError })
    }

    throw new Error(QA_CLIENT_ERROR)
  }
}

// ============================================================
// FLAGGAD-RAPPORT: Vad användaren ser vid flaggning
// ============================================================
export function getFlaggedUserResponse(sourceType: string) {
  if (sourceType === 'contract') {
    return {
      status: 'review_pending',
      message: 'Ditt avtal genomgår kvalitetskontroll innan det levereras. Du får det inom kort.',
      estimated_time: '1-2 timmar under kontorstid',
      contact: 'Vid frågor, boka ett samtal på johntengstrom.se/boka',
    }
  }
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
