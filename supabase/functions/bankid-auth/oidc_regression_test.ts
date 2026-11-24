import { deepStrictEqual, rejects } from 'node:assert/strict'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'npm:jose@6.2.16'
import { InvalidSignicatSession, verifySignicatSession } from './signicat.ts'

const issuer = 'https://signicat.example/auth/open'
const audience = 'grundat-test'
const subject = 'test-subject'
const { publicKey, privateKey } = await generateKeyPair('RS256')
const keys = createLocalJWKSet({ keys: [await exportJWK(publicKey)] })

async function verify(claims: JWTPayload, ageSeconds = 0) {
  const now = Math.floor(Date.now() / 1000)
  const idToken = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt(now - ageSeconds)
    .setExpirationTime(now + 600)
    .sign(privateKey)

  return verifySignicatSession(idToken, 'syntetisk-access-token', issuer, audience, keys, () => {
    throw new Error('UserInfo kräver ett kryptografiskt bundet access-token')
  })
}

Deno.test('BankID nekar gamla ID-token även när exp fortfarande är giltigt', async () => {
  await rejects(verify({ idp: 'sbid', nin: '200001010000' }, 360), InvalidSignicatSession)
})

Deno.test('BankID utan at_hash använder signerad identitet och kräver BankID-metod och personnummer', async () => {
  deepStrictEqual(await verify({ idp: 'sbid', nin: '20000101-0000', name: 'Testanvändare' }), {
    subject, personalNumber: '200001010000', name: 'Testanvändare',
  })
  await rejects(verify({ idp: 'sbid' }), InvalidSignicatSession)
  await rejects(verify({ nin: '200001010000' }), InvalidSignicatSession)
  await rejects(verify({ idp: 'sbid', nin: '200001010000', at_hash: 'fel-bindning' }), InvalidSignicatSession)
})
