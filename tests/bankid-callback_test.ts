import { deepStrictEqual, equal, rejects } from 'node:assert/strict'
import { InMemoryWebStorage, OidcClient, WebStorageStateStore } from 'npm:oidc-client-ts@3.4.1'
import { readBankIDCallback, requestBankIDLogin } from '../src/lib/bankid-flow.ts'

Deno.test('BankID-callback lämnar bara ut PKCE-underlag för rätt, ännu oanvänd state', async () => {
  const authority = 'https://signicat.example/auth/open'
  const redirectUri = 'https://app.example/callback'
  const oidc = new OidcClient({
    authority,
    client_id: 'grundat-test',
    redirect_uri: redirectUri,
    metadata: { authorization_endpoint: `${authority}/connect/authorize` },
    stateStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
  })

  await requestBankIDLogin(async (options) => {
    const authorization = await oidc.createSigninRequest(options)
    const { searchParams } = new URL(authorization.url)
    equal(searchParams.get('code_challenge_method'), 'S256')
    equal(searchParams.get('nonce'), options.nonce)
    equal(searchParams.get('prompt'), 'login')
    const code = 'syntetisk-kod'
    await rejects(readBankIDCallback(oidc, `${redirectUri}?state=fel-state&code=${code}`))

    const callbackUrl = `${redirectUri}?state=${authorization.state.id}&code=${code}`
    deepStrictEqual(await readBankIDCallback(oidc, callbackUrl), {
      code,
      codeVerifier: authorization.state.code_verifier,
      redirectUri,
      nonce: options.nonce,
    })
    await rejects(readBankIDCallback(oidc, callbackUrl))
  })
})
