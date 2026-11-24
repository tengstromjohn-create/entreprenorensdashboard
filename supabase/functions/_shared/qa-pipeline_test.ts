import assert from 'node:assert/strict'

// llm.ts läser modellförvalet vid import. Ladda pipelinen med en kontrollerad miljö.
async function loadPipelineWithDefaultModel() {
  const envGet = Deno.env.get
  Deno.env.get = (name) => name === 'QA_MODEL' ? undefined : envGet(name)
  try {
    return await import('./qa-pipeline.ts')
  } finally {
    Deno.env.get = envGet
  }
}

const { runQAPipeline } = await loadPipelineWithDefaultModel()

const input = {
  sourceType: 'contract',
  geminiOutput: { title: 'Testavtal', content_markdown: 'Syntetiskt avtalsutkast.' },
  geminiMeta: { model: 'gemini-test', latencyMs: 1 },
} as const

const approved = {
  verdict: 'approve',
  confidence: 0.9,
  issues: [],
  summary: 'Granskat.',
  corrected_output: null,
}

const reviewId = 'test-review'
const reviewUrl = 'https://supabase.example/rest/v1/ai_qa_reviews'
const qaUrl = 'https://api.anthropic.com/v1/messages'
const clientError = /^Error: Kvalitetskontrollen misslyckades\. Dokumentet kunde inte levereras\./

function claudeResponse(
  verdict: unknown = approved,
  { text = JSON.stringify(verdict), stopReason = 'end_turn', outputTokens = 5 } = {},
) {
  return Response.json({
    content: [
      { type: 'thinking', thinking: 'Syntetisk analys.' },
      { type: 'text', text },
    ],
    stop_reason: stopReason,
    usage: { input_tokens: 12, output_tokens: outputTokens },
  })
}

async function withMockQa(
  options: {
    keyMissing?: boolean
    modelOverride?: string
    respond?: (request: Record<string, unknown>) => Response
    rejectStatus?: string
  },
  test: (state: {
    writes: Record<string, unknown>[]
    qaRequests: Record<string, unknown>[]
    errors: unknown[][]
  }) => Promise<void>,
) {
  const envGet = Deno.env.get
  const originalFetch = globalThis.fetch
  const originalError = console.error
  const writes: Record<string, unknown>[] = []
  const qaRequests: Record<string, unknown>[] = []
  const errors: unknown[][] = []

  Deno.env.get = (name) => {
    switch (name) {
      case 'ANTHROPIC_API_KEY': return options.keyMissing ? undefined : 'fake-anthropic-key'
      case 'QA_MODEL': return options.modelOverride
      case 'SUPABASE_URL': return 'https://supabase.example'
      case 'SUPABASE_SERVICE_ROLE_KEY': return 'fake-service-role-key'
      default: return envGet(name)
    }
  }
  console.error = (...args: unknown[]) => {
    errors.push(args)
  }
  globalThis.fetch = async (resource, init) => {
    const request = new Request(resource, init)
    const url = new URL(request.url)
    if (request.url === qaUrl && request.method === 'POST') {
      const body = await request.json()
      qaRequests.push(body)
      return options.respond ? options.respond(body) : claudeResponse()
    }

    assert.equal(`${url.origin}${url.pathname}`, reviewUrl)
    assert.ok(request.method === 'POST' || request.method === 'PATCH')
    if (request.method === 'PATCH') {
      assert.equal(url.searchParams.get('id'), `eq.${reviewId}`)
      assert.equal(url.searchParams.get('select'), 'id')
    }
    const body = await request.json()
    writes.push(body)
    if (body.qa_status === options.rejectStatus) {
      return Response.json({ code: 'test_write_error', message: 'Syntetiskt skrivfel' }, { status: 400 })
    }
    return Response.json({ id: reviewId })
  }

  try {
    await test({ writes, qaRequests, errors })
  } finally {
    Deno.env.get = envGet
    globalThis.fetch = originalFetch
    console.error = originalError
  }
}

Deno.test('Godkänt QA levererar avtalet efter loggad granskning och använder modellförvalet', async () => {
  await withMockQa({}, async ({ writes, qaRequests }) => {
    const result = await runQAPipeline(input)
    assert.deepEqual(result, {
      finalOutput: input.geminiOutput,
      qaStatus: 'approved',
      qaReviewId: reviewId,
      wasAutoDelivered: true,
    })
    assert.deepEqual(writes.map((entry) => entry.qa_status), ['pending', 'approved'])
    assert.equal(qaRequests.length, 1)
    assert.equal(qaRequests[0].model, 'claude-sonnet-5-5')
    assert.equal(writes[1].qa_model, qaRequests[0].model)
    assert.equal(writes[1].qa_tokens_in, 12)
    assert.equal(writes[1].qa_tokens_out, 5)
    assert.equal(typeof writes[1].delivered_at, 'string')
  })
})

Deno.test('En explicit QA_MODEL används i Anthropic-anropet', async () => {
  const modelOverride = 'qa-model-fixture'
  await withMockQa({ modelOverride }, async ({ qaRequests }) => {
    // En separat modulinstans testar konfigurationen vid uppstart.
    const { qaWithClaude } = await import('./llm.ts?qa-model-override')
    await qaWithClaude('Syntetiska instruktioner.', 'Syntetiskt underlag.')
    assert.equal(qaRequests.length, 1)
    assert.equal(qaRequests[0].model, modelOverride)
  })
})

Deno.test('Giltig korrigering levereras och flaggning går till manuell granskning', async () => {
  const corrected = { title: 'Granskat testavtal', content_markdown: 'Korrigerad text.' }
  await withMockQa({ respond: () => claudeResponse({ ...approved, verdict: 'correct', corrected_output: corrected }) }, async ({ writes }) => {
    const result = await runQAPipeline(input)
    assert.equal(result.qaStatus, 'corrected')
    assert.equal(result.wasAutoDelivered, true)
    assert.deepEqual(result.finalOutput, corrected)
    assert.deepEqual(writes[1].final_output, corrected)
  })

  await withMockQa({ respond: () => claudeResponse({ ...approved, verdict: 'flag' }) }, async ({ writes }) => {
    const result = await runQAPipeline(input)
    assert.equal(result.qaStatus, 'flagged')
    assert.equal(result.wasAutoDelivered, false)
    assert.equal(writes[1].delivered_at, null)
  })
})

Deno.test('En fullständig avtalskorrigering ryms inom QA-anropets utökade tokentak', async () => {
  const corrected = {
    title: 'Granskat testavtal',
    content_markdown: 'Det här är en syntetisk, korrigerad avtalsbestämmelse.\n'.repeat(1_200),
  }
  const outputTokens = 16_500
  await withMockQa({
    respond: ({ max_tokens }) => {
      if (typeof max_tokens !== 'number' || max_tokens < outputTokens) {
        return claudeResponse(approved, { text: '{', stopReason: 'max_tokens' })
      }
      return claudeResponse({ ...approved, verdict: 'correct', corrected_output: corrected }, { outputTokens })
    },
  }, async ({ writes, qaRequests }) => {
    const result = await runQAPipeline(input)
    assert.equal(qaRequests[0].max_tokens, 32_768)
    assert.equal(result.qaStatus, 'corrected')
    assert.equal(result.wasAutoDelivered, true)
    assert.deepEqual(result.finalOutput, corrected)
    assert.deepEqual(writes.map((entry) => entry.qa_status), ['pending', 'corrected'])
    assert.equal(writes[1].qa_tokens_out, outputTokens)
    assert.equal(typeof writes[1].delivered_at, 'string')
  })
})

Deno.test('Ett giltigt QA-svar i ett JSON-kodblock godkänns', async () => {
  const text = ` \n\`\`\`json\r\n${JSON.stringify(approved, null, 2)}\r\n\`\`\`\n `
  await withMockQa({ respond: () => claudeResponse(approved, { text }) }, async ({ writes }) => {
    const result = await runQAPipeline(input)
    assert.equal(result.qaStatus, 'approved')
    assert.equal(result.wasAutoDelivered, true)
    assert.deepEqual(writes.map((entry) => entry.qa_status), ['pending', 'approved'])
  })
})

const failedQaCases = [
  { name: 'Saknad nyckel', keyMissing: true, reason: 'ANTHROPIC_API_KEY not configured' },
  { name: 'API-fel', respond: () => new Response(null, { status: 503 }), reason: 'Claude API error: 503' },
  { name: 'Nätverksfel', respond: () => { throw new Error('Syntetiskt nätverksfel') }, reason: 'Claude API network error' },
  { name: 'Ogiltig JSON', respond: () => claudeResponse(approved, { text: 'syntetisk råtext' }), reason: 'Claude QA returned invalid JSON' },
  { name: 'JSON-kodblock med omgivande text', respond: () => claudeResponse(approved, { text: `Inledning\n\`\`\`json\n${JSON.stringify(approved)}\n\`\`\`` }), reason: 'Claude QA returned invalid JSON' },
  { name: 'Ofullständigt svar', respond: () => claudeResponse(approved, { stopReason: 'max_tokens' }), reason: 'Claude QA did not return a complete response' },
  { name: 'Okänt beslut', respond: () => claudeResponse({ ...approved, verdict: 'unknown' }), reason: 'Invalid Claude QA verdict' },
  { name: 'Ofullständig granskning', respond: () => claudeResponse({ verdict: 'approve' }), reason: 'Invalid Claude QA verdict' },
  { name: 'Felaktiga QA-anmärkningar', respond: () => claudeResponse({ ...approved, issues: [null] }), reason: 'Invalid Claude QA verdict' },
  { name: 'Saknad korrigering', respond: () => claudeResponse({ ...approved, verdict: 'correct' }), reason: 'Missing Claude QA correction' },
  { name: 'Ogiltig avtalskorrigering', respond: () => claudeResponse({ ...approved, verdict: 'correct', corrected_output: {} }), reason: 'Invalid Claude QA contract correction' },
]

for (const testCase of failedQaCases) {
  Deno.test(`${testCase.name} stoppar leverans och loggas`, async () => {
    await withMockQa(testCase, async ({ writes, qaRequests, errors }) => {
      await assert.rejects(runQAPipeline(input), clientError)
      assert.deepEqual(writes.map((entry) => entry.qa_status), ['pending', 'failed'])
      assert.equal(writes[1].final_output, null)
      assert.equal(writes[1].delivered_at, null)
      assert.deepEqual(writes[1].qa_verdict, { verdict: 'failed', note: testCase.reason })
      assert.deepEqual(errors, [['Claude QA failed', { reviewId, reason: testCase.reason }]])
      assert.equal(qaRequests.length, testCase.keyMissing ? 0 : 1)
    })
  })
}

Deno.test('En misslyckad skrivning av godkänd granskning stoppar leveransen', async () => {
  await withMockQa({ rejectStatus: 'approved' }, async ({ writes, errors }) => {
    await assert.rejects(runQAPipeline(input), clientError)
    assert.deepEqual(writes.map((entry) => entry.qa_status), ['pending', 'approved', 'failed'])
    assert.equal(writes[2].delivered_at, null)
    assert.deepEqual(errors[0], ['Claude QA failed', { reviewId, reason: 'QA review update failed (test_write_error)' }])
  })
})

Deno.test('Skrivfel vid misslyckad granskning loggas och leveransen förblir stoppad', async () => {
  await withMockQa({ keyMissing: true, rejectStatus: 'failed' }, async ({ writes, errors }) => {
    await assert.rejects(runQAPipeline(input), clientError)
    assert.deepEqual(writes.map((entry) => entry.qa_status), ['pending', 'failed'])
    assert.equal(errors[1][0], 'Could not persist failed Claude QA review')
  })
})

Deno.test('Avvecklat QA-modell-ID saknas i Edge Functions', () => {
  const retiredModel = ['claude-sonnet-4', '20250514'].join('-')

  function checkSources(directory: URL) {
    for (const entry of Deno.readDirSync(directory)) {
      const path = new URL(entry.name + (entry.isDirectory ? '/' : ''), directory)
      if (entry.isDirectory) {
        checkSources(path)
      } else if (entry.isFile && /\.[cm]?[jt]sx?$/.test(entry.name)) {
        assert.ok(!Deno.readTextFileSync(path).includes(retiredModel), `Avvecklat modell-ID i ${path.pathname}`)
      }
    }
  }

  checkSources(new URL('../', import.meta.url))
})

// Avvecklingsdatum för Claude- och Gemini-modeller som är relevanta för textgenerering här.
// https://platform.claude.com/docs/en/about-claude/model-deprecations
// https://aistudio.google.com/docs/deprecations
const modelRetirements: Record<string, string> = {
  'claude-3-haiku-20240307': '2026-04-20',
  'claude-3-opus-20240229': '2026-01-05',
  'claude-3-sonnet-20240229': '2025-07-21',
  'claude-3-5-haiku-20241022': '2026-02-19',
  'claude-3-5-sonnet-20240620': '2025-10-28',
  'claude-3-5-sonnet-20241022': '2025-10-28',
  'claude-3-7-sonnet-20250219': '2026-02-19',
  'claude-opus-4-20250514': '2026-06-15',
  'claude-opus-4-1-20250805': '2026-08-05',
  'claude-opus-4-5': '2027-01-22',
  'claude-opus-4-5-20251101': '2027-01-22',
  'claude-sonnet-4-5': '2026-11-30',
  'claude-sonnet-4-5-20250929': '2026-11-30',
  [['claude-sonnet-4', '20250514'].join('-')]: '2026-06-15',
  'gemini-2.0-flash': '2026-06-01',
  'gemini-2.0-flash-001': '2026-06-01',
  'gemini-2.0-flash-lite': '2026-06-01',
  'gemini-2.0-flash-lite-001': '2026-06-01',
  'gemini-2.5-flash': '2026-12-01',
  'gemini-2.5-pro': '2026-12-01',
}

function retiredModelsIn(source: string, date: string): string[] {
  const words = new Set(source.match(/[\w-]+(?:\.[\w-]+)*/g))
  return Object.entries(modelRetirements)
    .filter(([model, retiredOn]) => retiredOn <= date && words.has(model))
    .map(([model]) => model)
}

Deno.test('Modellkontrollen skiljer datum och exakta modell-ID:n åt', () => {
  const source = '"claude-opus-4-20250514" "models/gemini-2.5-flash" "gemini-2.5-flash-lite"'
  assert.deepEqual(retiredModelsIn(source, '2026-11-30'), ['claude-opus-4-20250514'])
  assert.deepEqual(retiredModelsIn(source, '2026-12-01'), ['claude-opus-4-20250514', 'gemini-2.5-flash'])
})

Deno.test('Edge Functions innehåller inga modell-ID:n vars avvecklingsdatum har passerat', () => {
  const today = new Date().toISOString().slice(0, 10)
  const root = new URL('../', import.meta.url)
  const findings: string[] = []

  function checkSources(directory: URL) {
    for (const entry of Deno.readDirSync(directory)) {
      const path = new URL(entry.name + (entry.isDirectory ? '/' : ''), directory)
      if (entry.isDirectory) {
        checkSources(path)
      } else if (entry.isFile && path.href !== import.meta.url && /\.[cm]?[jt]sx?$/.test(entry.name)) {
        for (const model of retiredModelsIn(Deno.readTextFileSync(path), today)) {
          findings.push(`${path.pathname}: ${model} (avvecklad ${modelRetirements[model]})`)
        }
      }
    }
  }

  checkSources(root)
  assert.deepEqual(findings, [], `Avvecklade modell-ID:n:\n${findings.join('\n')}`)
})
