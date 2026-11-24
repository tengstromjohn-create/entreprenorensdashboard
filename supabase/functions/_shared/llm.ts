/**
 * Modellabstraktionslager (S28-3, 2026-07-05).
 *
 * En enda plats där GENERATION_MODEL (Gemini) och QA_MODEL (Claude) definieras
 * och där fetch-mekaniken mot respektive leverantör ligger. Defaults matchar
 * det som körde live 2026-07-04 — inga beteendeförändringar sker vid införandet;
 * modellväxling görs i S32 som ren env-konfiguration.
 *
 * Krav på graceful degradation i qa-pipeline bevaras: den saknade nyckeln
 * hanteras av anroparen (se _shared/qa-pipeline.ts), qaWithClaude här kastar
 * på HTTP-fel så att fallbacken triggas.
 */

export const GENERATION_MODEL =
  Deno.env.get('GENERATION_MODEL') ?? 'gemini-2.5-flash'

export const QA_MODEL =
  Deno.env.get('QA_MODEL') ?? 'claude-sonnet-4-20250514'

export interface LlmResult {
  text: string | undefined
  tokensIn?: number
  tokensOut?: number
}

/**
 * Gemini generateContent — ersätter de tre inline-fetcharna.
 * Config-fälten är valfria och skickas endast om anroparen sätter dem
 * (så att t.ex. startup-docs inte får med en thinkingConfig som inte fanns förut).
 */
export async function generateWithGemini(
  prompt: string,
  config?: {
    temperature?: number
    maxOutputTokens?: number
    thinkingBudget?: number
    responseMimeType?: string
  }
): Promise<LlmResult> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY not configured')
  }

  const generationConfig: {
    temperature?: number
    maxOutputTokens?: number
    thinkingConfig?: { thinkingBudget: number }
    responseMimeType?: string
  } = {}
  if (config?.temperature !== undefined) generationConfig.temperature = config.temperature
  if (config?.maxOutputTokens !== undefined) generationConfig.maxOutputTokens = config.maxOutputTokens
  if (config?.thinkingBudget !== undefined) generationConfig.thinkingConfig = { thinkingBudget: config.thinkingBudget }
  if (config?.responseMimeType !== undefined) generationConfig.responseMimeType = config.responseMimeType

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GENERATION_MODEL}:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
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

/**
 * Anthropic Messages — ersätter fetchen i qa-pipeline.
 * Kastar vid saknad nyckel och HTTP-fel; qa-pipelinens graceful degradation
 * (saknad nyckel → auto-approve, Claude-fel → Gemini-output godkänns) sköts
 * av anroparen och är oförändrad.
 */
export async function qaWithClaude(
  system: string,
  userContent: string,
  maxTokens?: number
): Promise<LlmResult & { raw: unknown }> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: QA_MODEL,
      max_tokens: maxTokens ?? 4096,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  })

  if (!resp.ok) {
    throw new Error(`Claude API error: ${resp.status}`)
  }

  const data = await resp.json()
  return {
    text: data.content?.[0]?.text as string | undefined,
    tokensIn: data.usage?.input_tokens as number | undefined,
    tokensOut: data.usage?.output_tokens as number | undefined,
    raw: data,
  }
}
