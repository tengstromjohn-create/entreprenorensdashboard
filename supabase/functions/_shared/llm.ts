/**
 * Modellabstraktionslager (S28-3, 2026-07-05).
 *
 * Modellförval och API-anrop för Gemini och Claude. Modellval kan
 * åsidosättas med GENERATION_MODEL och QA_MODEL.
 */

export const GENERATION_MODEL =
  Deno.env.get('GENERATION_MODEL') ?? 'gemini-2.5-flash'

export const QA_MODEL =
  Deno.env.get('QA_MODEL') ?? 'claude-sonnet-5-5'

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
 * Anthropic Messages för QA. Returnerar textblock från ett slutfört svar.
 */
export async function qaWithClaude(
  system: string,
  userContent: string,
  maxTokens?: number
): Promise<LlmResult> {
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
  }).catch(() => {
    throw new Error('Claude API network error')
  })

  if (!resp.ok) {
    throw new Error(`Claude API error: ${resp.status}`)
  }

  const data = await resp.json().catch(() => {
    throw new Error('Invalid Claude API response')
  })
  if (data?.stop_reason !== 'end_turn' || !Array.isArray(data.content)) {
    throw new Error('Claude QA did not return a complete response')
  }

  return {
    text: data.content
      .filter((block: { type?: string; text?: unknown } | null) =>
        block?.type === 'text' && typeof block.text === 'string'
      )
      .map((block: { text: string }) => block.text)
      .join(''),
    tokensIn: data.usage?.input_tokens as number | undefined,
    tokensOut: data.usage?.output_tokens as number | undefined,
  }
}
