import { deepStrictEqual, equal } from 'node:assert/strict'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { base64url } from 'npm:jose@6.2.16'
import { createContractHandler } from './handler.ts'

const userId = '10000000-0000-4000-8000-000000000001'
const sessionId = '10000000-0000-4000-8000-000000000002'
const contract = { title: 'Syntetiskt NDA', content_markdown: 'Testvillkor' }

function contractFixture({ failInsert = false } = {}) {
  const claims = base64url.encode(JSON.stringify({ sub: userId, role: 'authenticated', session_id: sessionId }))
  const token = `header.${claims}.signatur`
  const qaUserIds: string[] = []
  const savedUserIds: string[] = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const req = new Request(input, init)
    const { pathname, searchParams } = new URL(req.url)
    if (pathname === '/auth/v1/user') {
      equal(req.headers.get('Authorization'), `Bearer ${token}`)
      return Response.json({ id: userId, app_metadata: { bankid_session_id: sessionId } })
    }
    equal(pathname, '/rest/v1/contracts')
    equal(req.method, 'POST')
    equal(searchParams.get('select'), 'id')
    const { user_id, content_markdown, qa_review_id } = await req.json()
    savedUserIds.push(user_id)
    equal(content_markdown, contract.content_markdown)
    equal(qa_review_id, 'qa-test')
    return failInsert
      ? Response.json({ code: 'XX000', message: 'syntetiskt internt fel' }, { status: 500 })
      : Response.json({ id: 'avtal-test' }, { status: 201 })
  }
  const admin = createClient('https://supabase.example', 'syntetisk-service-nyckel', {
    global: { fetch }, auth: { autoRefreshToken: false, persistSession: false },
  })
  const handle = createContractHandler({
    getAdmin: () => admin,
    isGenerationConfigured: () => true,
    generate: async () => ({ text: JSON.stringify(contract) }),
    generationModel: 'testmodell',
    runQA: async (input) => {
      equal(input.sourceType, 'contract')
      qaUserIds.push(input.userId)
      return { finalOutput: input.geminiOutput, qaReviewId: 'qa-test', qaStatus: 'corrected', wasAutoDelivered: true }
    },
    getFlaggedResponse: () => ({ status: 'review_pending' }),
  })

  return {
    qaUserIds,
    savedUserIds,
    request: () => handle(new Request('https://edge.example/generate-contract', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ contractType: 'nda', formAnswers: {}, userId: 'annat-konto', trustLevel: 'bankid' }),
    })),
  }
}

Deno.test('Avtalets handler använder samma verifierade id för QA och sparad ägare', async () => {
  const { request, qaUserIds, savedUserIds } = contractFixture()
  const response = await request()
  equal(response.status, 200)
  equal((await response.json()).contractId, 'avtal-test')
  deepStrictEqual(qaUserIds, [userId])
  deepStrictEqual(savedUserIds, [userId])
})

Deno.test('Avtalets handler returnerar 500 utan avtal när skrivningen misslyckas', async () => {
  const { request, savedUserIds } = contractFixture({ failInsert: true })
  const response = await request()
  equal(response.status, 500)
  deepStrictEqual(await response.json(), { error: 'Avtalet kunde inte sparas. Försök igen.' })
  deepStrictEqual(savedUserIds, [userId])
})
