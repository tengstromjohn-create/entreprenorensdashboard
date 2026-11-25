import { deepStrictEqual, rejects } from 'node:assert/strict'
import { base64url, createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'npm:jose@6.2.16'
import { InvalidSignicatSession, verifySignicatSession } from './signicat.ts'

const issuer = 'https://signicat.example/auth/open'
const audience = 'grundat-test'
const accessToken = 'syntetisk-access-token'
const subject = 'signicat-testanvändare'
const { publicKey, privateKey } = await generateKeyPair('RS256')
const wrongKey = (await generateKeyPair('RS256')).privateKey
const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accessToken))
const atHash = base64url.encode(new Uint8Array(digest).subarray(0, 16))
const keys = createLocalJWKSet({ keys: [await exportJWK(publicKey)] })

function sign(idp = 'sbid', tokenAudience = audience, key = privateKey, expiration: number | string = '5m') {
  return new SignJWT({ at_hash: atHash, idp })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(issuer)
    .setAudience(tokenAudience)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(key)
}

Deno.test('Signicat verifierar signatur och hämtar identitet från matchande UserInfo', async () => {
  const identity = await verifySignicatSession(
    await sign(), accessToken, issuer, audience, keys, async (token) => {
      if (token !== accessToken) throw new Error('Fel token nådde UserInfo')
      return { sub: subject, nin: '20000101-0000', name: 'Testanvändare' }
    },
  )
  deepStrictEqual(identity, { subject, name: 'Testanvändare', personalNumber: '200001010000' })
})

Deno.test('fel signatur, utfärdare, klient, utgången token eller annan e-legitimation nekas före UserInfo', async () => {
  const wrongCredentials = [
    { idToken: await sign('sbid', audience, wrongKey) },
    { idToken: await sign(), expectedIssuer: 'https://another.example/auth/open' },
    { idToken: await sign('sbid', 'annan-klient') },
    { idToken: await sign('sbid', audience, privateKey, 1) },
    { idToken: await sign('freja') },
    { idToken: await sign(), access: 'annat-access-token' },
  ]

  for (const { idToken, expectedIssuer = issuer, access = accessToken } of wrongCredentials) {
    await rejects(
      verifySignicatSession(idToken, access, expectedIssuer, audience, keys, () => {
        throw new Error('Ogiltiga token får inte nå UserInfo')
      }),
      InvalidSignicatSession,
    )
  }
})

Deno.test('UserInfo med annat subject eller utan giltigt personnummer kan inte verifieras', async () => {
  const idToken = await sign()
  for (const info of [{ sub: 'annan-användare', nin: '200001010000' }, { sub: subject }]) {
    await rejects(
      verifySignicatSession(idToken, accessToken, issuer, audience, keys, async () => info),
      InvalidSignicatSession,
    )
  }
})
