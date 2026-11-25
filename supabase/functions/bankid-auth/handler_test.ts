import { deepStrictEqual, equal, match } from 'node:assert/strict'
import { createBankIDHandler } from './handler.ts'
import { InvalidSignicatSession } from './signicat.ts'

Deno.test('BankID-handlern kontrollerar metoden och PKCE-underlaget före sessionsutbyte', async () => {
  const url = 'https://edge.example/bankid-auth'
  const identity = { name: 'Testanvändare', personalNumber: '200001010000', subject: 'test-subject' }
  let verified = 0
  let exchanged = 0
  const codeVerifier = 'a'.repeat(43)
  const redirectUri = 'https://app.example/callback'
  const nonce = 'syntetisk-nonce'
  const handle = createBankIDHandler(async ({ code, ...proof }) => {
    verified++
    deepStrictEqual(proof, { codeVerifier, redirectUri, nonce })
    if (code === 'ogiltigt-bevis') throw new InvalidSignicatSession('syntetisk intern feltext')
    return identity
  }, async (verifiedIdentity) => {
    deepStrictEqual(verifiedIdentity, identity)
    exchanged++
    if (exchanged === 1) throw new Error('syntetisk intern feltext')
    return { access_token: 'syntetisk-access', refresh_token: 'syntetisk-refresh' }
  })

  function post(code: string) {
    return new Request(url, { method: 'POST', body: JSON.stringify({ code, codeVerifier, redirectUri, nonce }) })
  }

  equal((await handle(new Request(url))).status, 405)
  equal((await handle(new Request(url, { method: 'POST', body: '{}' }))).status, 400)
  equal(verified, 0)

  const denied = await handle(post('ogiltigt-bevis'))
  equal(denied.status, 401)
  deepStrictEqual(await denied.json(), { error: 'Signicat-sessionen kunde inte verifieras' })
  equal(exchanged, 0)

  const unavailable = await handle(post('giltigt-bevis'))
  equal(unavailable.status, 503)
  deepStrictEqual(await unavailable.json(), { error: 'BankID-inloggningen kunde inte slutföras. Försök igen.' })

  const accepted = await handle(post('ny-giltig-kod'))
  equal(accepted.status, 200)
  match(accepted.headers.get('Cache-Control') ?? '', /^no-store$/)
  deepStrictEqual(await accepted.json(), { accessToken: 'syntetisk-access', refreshToken: 'syntetisk-refresh' })
})
