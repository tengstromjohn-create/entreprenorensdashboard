import { deepStrictEqual, equal, rejects } from 'node:assert/strict'
import { base64url, exportJWK, generateKeyPair, SignJWT } from 'npm:jose@6.2.16'
import { createBankIDHandler } from './handler.ts'
import { createSignicatVerifier, InvalidSignicatSession } from './signicat.ts'

const origin = 'https://signicat.example'
const issuer = `${origin}/auth/open`
const audience = 'syntetisk-bankid-klient'
const subject = 'syntetiskt-subject'
const accessToken = 'syntetiskt-access-token'
const proof = {
  code: 'syntetisk-bankid-kod',
  codeVerifier: 'a'.repeat(43),
  redirectUri: 'https://app.example/callback',
  nonce: 'syntetisk-nonce',
}
const { publicKey, privateKey } = await generateKeyPair('RS256')

async function mockSignicat({ simultaneous = false, atHash = true } = {}) {
  const idToken = await new SignJWT({
    nonce: proof.nonce,
    idp: 'sbid',
    given_name: 'Testa',
    family_name: 'Bankidsson',
    ...(atHash ? {
      at_hash: base64url.encode(new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accessToken)),
      ).subarray(0, 16)),
    } : { nin: '200001010000' }),
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey)

  let consumed = false
  let tokenRequests = 0
  let userInfoRequests = 0
  const concurrent = Promise.withResolvers<void>()
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    const { pathname } = new URL(request.url)
    if (pathname.endsWith('/.well-known/openid-configuration')) {
      return Response.json({
        issuer,
        jwks_uri: `${origin}/jwks`,
        token_endpoint: `${origin}/token`,
        userinfo_endpoint: `${origin}/userinfo`,
      })
    }
    if (pathname === '/jwks') return Response.json({ keys: [await exportJWK(publicKey)] })
    if (pathname === '/userinfo') {
      userInfoRequests++
      equal(request.headers.get('Authorization'), `Bearer ${accessToken}`)
      return Response.json({
        sub: subject,
        nin: '200001010000',
        nin_type: 'PERSON',
        nin_issuing_country: 'SE',
        given_name: 'Testa',
        family_name: 'Bankidsson',
      })
    }
    equal(pathname, '/token')
    equal(request.method, 'POST')
    const params = await request.formData()
    deepStrictEqual(Object.fromEntries(params), {
      grant_type: 'authorization_code',
      client_id: audience,
      code: proof.code,
      code_verifier: params.get('code_verifier'),
      redirect_uri: proof.redirectUri,
    })
    tokenRequests++
    if (params.get('code_verifier') !== proof.codeVerifier || consumed) {
      if (simultaneous && tokenRequests === 2) concurrent.resolve()
      return Response.json({ error: 'invalid_grant' }, { status: 400 })
    }
    consumed = true
    if (simultaneous) await concurrent.promise
    return Response.json({ id_token: idToken, access_token: accessToken })
  }
  return {
    newVerifier: () => createSignicatVerifier(issuer, audience, fetcher),
    requests: () => ({ tokenRequests, userInfoRequests }),
  }
}

Deno.test('Samma PKCE-kod kan inte ge flera Supabase-sessioner vid samtidiga anrop eller omförsök', async () => {
  const signicat = await mockSignicat({ simultaneous: true })
  const bindings: string[] = []
  const startSession = () => {
    const id = `session-${bindings.length + 1}`
    bindings.push(id)
    return Promise.resolve({ access_token: id, refresh_token: `refresh-${id}` })
  }
  const firstHandler = createBankIDHandler(signicat.newVerifier(), startSession)
  const secondHandler = createBankIDHandler(signicat.newVerifier(), startSession)
  const post = (body = proof) => new Request('https://edge.example/bankid-auth', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const oldTokenBody = new Request('https://edge.example/bankid-auth', {
    method: 'POST',
    body: JSON.stringify({ idToken: 'tidigare-id-token', accessToken }),
  })
  equal((await firstHandler(oldTokenBody)).status, 400)
  equal(signicat.requests().tokenRequests, 0)

  const responses = await Promise.all([firstHandler(post()), secondHandler(post())])
  deepStrictEqual(responses.map((response) => response.status).sort(), [200, 401])
  const accepted = responses.find((response) => response.ok)!
  deepStrictEqual(await accepted.json(), { accessToken: 'session-1', refreshToken: 'refresh-session-1' })
  const rejected = responses.find((response) => !response.ok)!
  deepStrictEqual(await rejected.json(), { error: 'Signicat-sessionen kunde inte verifieras' })
  equal((await firstHandler(post())).status, 401)
  deepStrictEqual(bindings, ['session-1'])
  deepStrictEqual(signicat.requests(), { tokenRequests: 3, userInfoRequests: 1 })
})

Deno.test('Fel verifierare eller nonce godkänns inte som svar på den påbörjade inloggningen', async () => {
  const signicat = await mockSignicat()
  const verify = signicat.newVerifier()
  await rejects(verify({ ...proof, codeVerifier: 'b'.repeat(43) }), InvalidSignicatSession)
  await rejects(verify({ ...proof, nonce: 'annan-inloggning' }), InvalidSignicatSession)
  deepStrictEqual(signicat.requests(), { tokenRequests: 2, userInfoRequests: 0 })
})

Deno.test('Signicats BankID-claims med för- och efternamn ger visningsnamn med och utan UserInfo', async () => {
  for (const atHash of [true, false]) {
    const signicat = await mockSignicat({ atHash })
    deepStrictEqual(await signicat.newVerifier()(proof), {
      subject,
      personalNumber: '200001010000',
      name: 'Testa Bankidsson',
    })
    equal(signicat.requests().userInfoRequests, atHash ? 1 : 0)
  }
})
