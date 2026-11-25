import { deepStrictEqual, equal } from 'node:assert/strict'
import { base64url } from 'npm:jose@6.2.16'
import { withContractAuthorization } from './authorization.ts'

const userId = '10000000-0000-4000-8000-000000000001'
const sessionId = '10000000-0000-4000-8000-000000000002'
const sessionToken = [
  base64url.encode(JSON.stringify({ alg: 'HS256' })),
  base64url.encode(JSON.stringify({ sub: userId, role: 'authenticated', session_id: sessionId })),
  'signature-checked-by-mocked-auth-service',
].join('.')

function request(authorization?: string): Request {
  return new Request('https://edge.example/generate-contract', {
    method: 'POST',
    headers: authorization ? { Authorization: authorization } : undefined,
    body: JSON.stringify({
      contractType: 'nda',
      formAnswers: {},
      trustLevel: 'bankid',
      userId: 'annat-konto',
    }),
  })
}

Deno.test('förfalskad body utan session nekas före avtalsgenerering', async () => {
  const handle = withContractAuthorization(
    () => { throw new Error('Avtalsgenerering får inte köras') },
    () => { throw new Error('Auth får inget token när Authorization saknas') },
  )
  const response = await handle(request())
  equal(response.status, 401)
  equal((await response.json()).code, 'session_required')
})

Deno.test('förfalskad body kan inte ge en vanlig Supabase-session BankID-status', async () => {
  const handle = withContractAuthorization(
    () => { throw new Error('Avtalsgenerering får inte köras') },
    async () => ({
      data: { user: { id: userId, app_metadata: { bankid_session_id: 'en-annan-session' } } },
      error: null,
    }),
  )
  const response = await handle(request(`Bearer ${sessionToken}`))
  equal(response.status, 403)
  equal((await response.json()).code, 'trust_level_required')
})

Deno.test('verifierad BankID-session godkänns med användar-id från Auth', async () => {
  const handle = withContractAuthorization(
    async (req, authenticatedId) => {
      equal((await req.json()).contractType, 'nda')
      return Response.json({ userId: authenticatedId })
    },
    async (token) => {
      equal(token, sessionToken)
      return {
        data: { user: { id: userId, app_metadata: { bankid_session_id: sessionId } } },
        error: null,
      }
    },
  )
  const response = await handle(request(`Bearer ${sessionToken}`))
  equal(response.status, 200)
  deepStrictEqual(await response.json(), { userId })
})

Deno.test('ogiltig token nekas även om dess session-id ser giltigt ut', async () => {
  const handle = withContractAuthorization(
    () => { throw new Error('Avtalsgenerering får inte köras') },
    async () => ({ data: { user: null }, error: { status: 403 } }),
  )
  const response = await handle(request(`Bearer ${sessionToken}`))
  equal(response.status, 401)
})

Deno.test('fel från Supabase Auth rapporteras som tjänstefel', async () => {
  const handle = withContractAuthorization(
    () => { throw new Error('Avtalsgenerering får inte köras') },
    async () => ({ data: { user: null }, error: { status: 500 } }),
  )
  const response = await handle(request(`Bearer ${sessionToken}`))
  equal(response.status, 503)
  equal((await response.json()).code, 'auth_unavailable')
})
