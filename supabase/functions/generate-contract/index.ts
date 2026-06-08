import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { runQAPipeline, getFlaggedUserResponse } from '../_shared/qa-pipeline.ts'
import { buildPrompt } from './prompts.ts'

/**
 * generate-contract (Spurt B, 2026-06-07) — avtalsmotor v1.
 *
 * Stödjer: NDA ('nda') + anställningsavtal ('employment').
 * Pipeline: Gemini 2.5 Flash genererar → Claude QA validerar (qa-pipeline) →
 * approve/correct levereras direkt, flag = manuell granskning (ALDRIG autokorrigering
 * av flaggat innehåll — flaggat innehåll levereras inte).
 *
 * Avtal genereras endast för BankID-verifierade användare (Johns namn står bakom).
 */

function sanitizeText(text: string): string {
  if (typeof text !== 'string') return ''
  return text.replace(/<[^>]*>/g, '').slice(0, 2000)
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>)
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
    const { contractType, formAnswers, companyData, trustLevel, userId, orgNumber, companyName } = await req.json()

    if (contractType !== 'nda' && contractType !== 'employment') {
      return new Response(
        JSON.stringify({ error: "contractType must be 'nda' or 'employment'" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!formAnswers || typeof formAnswers !== 'object') {
      return new Response(
        JSON.stringify({ error: 'formAnswers required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    // Avtalsgenerering kräver BankID — dokument med Johns namn bakom.
    if (trustLevel !== 'bankid' && trustLevel !== 'existing_client') {
      return new Response(
        JSON.stringify({ error: 'BankID-verifiering krävs för att generera avtal', code: 'trust_level_required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const admin = getAdminClient()
    const prompt = buildPrompt(contractType, sanitizeObject(formAnswers), companyData ?? {})
    const genStart = Date.now()

    const callGemini = async () => {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2, // lägre än health check — juridisk text ska vara förutsägbar
              // Thinking av + högre tak: tanke-tokens räknas in i maxOutputTokens och
              // trunkerade health check-JSON:en. Samma skydd här.
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
      return {
        text: data.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined,
        tokensIn: data.usageMetadata?.promptTokenCount as number | undefined,
        tokensOut: data.usageMetadata?.candidatesTokenCount as number | undefined,
      }
    }

    // Generera med en retry (samma mönster som generate-health-check)
    let contract: Record<string, unknown>
    let tokensIn: number | undefined
    let tokensOut: number | undefined
    try {
      const result = await callGemini()
      const parsed = JSON.parse(result.text || '{}')
      if (!parsed.content_markdown || !parsed.title) {
        throw new Error('Invalid response structure: missing content_markdown/title')
      }
      contract = parsed
      tokensIn = result.tokensIn
      tokensOut = result.tokensOut
    } catch (firstError) {
      console.error('generate-contract first attempt failed:', firstError)
      const retry = await callGemini()
      const parsed = JSON.parse(retry.text || '{}')
      if (!parsed.content_markdown || !parsed.title) {
        return new Response(
          JSON.stringify({ error: true, message: 'Avtalet kunde inte genereras. Försök igen.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      contract = parsed
      tokensIn = retry.tokensIn
      tokensOut = retry.tokensOut
    }
    const genLatencyMs = Date.now() - genStart

    // Claude QA — avtal är det mest känsliga vi genererar
    const qa = await runQAPipeline({
      sourceType: 'contract',
      userId: userId || undefined,
      geminiOutput: contract,
      geminiMeta: {
        model: 'gemini-2.5-flash',
        tokensIn,
        tokensOut,
        latencyMs: genLatencyMs,
      },
    })

    const finalContract = qa.finalOutput as {
      title?: string
      content_markdown?: string
      review_points?: unknown
      summary?: string
    }

    // Spara avtalet (service role — RLS-policyn släpper bara igenom egna SELECT:s)
    const { data: saved, error: saveError } = await admin
      .from('contracts')
      .insert({
        user_id: userId || null,
        org_number: orgNumber || null,
        company_name: companyName || null,
        contract_type: contractType,
        title: finalContract.title || null,
        input_data: formAnswers,
        content_markdown: qa.wasAutoDelivered ? (finalContract.content_markdown || null) : null,
        review_points: qa.wasAutoDelivered ? (finalContract.review_points ?? null) : null,
        summary: qa.wasAutoDelivered ? (finalContract.summary || null) : null,
        status: qa.wasAutoDelivered ? 'generated' : 'flagged',
        qa_review_id: qa.qaReviewId,
        qa_status: qa.qaStatus,
        gemini_model: 'gemini-2.5-flash',
        generation_latency_ms: genLatencyMs,
      })
      .select('id')
      .single()

    if (saveError) {
      console.error('contracts insert failed:', saveError.message)
    }

    // Flaggat avtal levereras INTE — manuell granskning först
    if (!qa.wasAutoDelivered) {
      return new Response(
        JSON.stringify({
          contractId: saved?.id ?? null,
          qaStatus: qa.qaStatus,
          ...getFlaggedUserResponse('contract'),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        contractId: saved?.id ?? null,
        status: 'generated',
        qaStatus: qa.qaStatus,
        title: finalContract.title,
        content_markdown: finalContract.content_markdown,
        review_points: finalContract.review_points ?? [],
        summary: finalContract.summary ?? '',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
