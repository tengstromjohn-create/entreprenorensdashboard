import assert from 'node:assert/strict'
import { runQAPipeline } from './qa-pipeline.ts'

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
  { text = JSON.stringify(verdict), stopReason = 'end_turn' } = {},
) {
  return Response.json({
    content: [
      { type: 'thinking', thinking: 'Syntetisk analys.' },
      { type: 'text', text },
    ],
    stop_reason: stopReason,
    usage: { input_tokens: 12, output_tokens: 5 },
  })
}

async function withMockQa(
  options: { keyMissing?: boolean; respond?: () => Response; rejectStatus?: string },
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
      qaRequests.push(await request.json())
      return options.respond ? options.respond() : claudeResponse()
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

const failedQaCases = [
  { name: 'Saknad nyckel', keyMissing: true, reason: 'ANTHROPIC_API_KEY not configured' },
  { name: 'API-fel', respond: () => new Response(null, { status: 503 }), reason: 'Claude API error: 503' },
  { name: 'Nätverksfel', respond: () => { throw new Error('Syntetiskt nätverksfel') }, reason: 'Claude API network error' },
  { name: 'Ogiltig JSON', respond: () => claudeResponse(approved, { text: 'syntetisk råtext' }), reason: 'Claude QA returned invalid JSON' },
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
