import { deepStrictEqual, equal, match } from 'node:assert/strict'
import { base64url } from 'npm:jose@6.2.16'
import { createClient } from 'npm:@supabase/supabase-js@2.97.0'
import { InMemoryWebStorage, OidcClient, WebStorageStateStore } from 'npm:oidc-client-ts@3.4.1'
import { handleBankIDRejection, requestBankIDLogin, signOutFromApp } from '../src/lib/bankid-flow.ts'
import { withContractAuthorization } from '../supabase/functions/generate-contract/authorization.ts'

Deno.test('BankID kräver en ny autentisering efter utloggning med aktiv Signicat-SSO', async () => {
  let localOIDC = true
  let supabaseSession = true
  const ssoActive = true
  let promptedForBankID = false
  const authority = 'https://signicat.example/auth/open'
  const oidc = new OidcClient({
    authority,
    client_id: 'grundat-test',
    redirect_uri: 'https://app.example/callback',
    metadata: { authorization_endpoint: `${authority}/connect/authorize` },
    stateStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
  })

  await signOutFromApp(async () => { localOIDC = false }, async () => {
    supabaseSession = false
    return { error: null }
  }, (message) => { throw new Error(message) })
  equal(localOIDC, false)
  equal(supabaseSession, false)

  await requestBankIDLogin(async (options) => {
    const request = await oidc.createSigninRequest(options)
    const { searchParams } = new URL(request.url)
    equal(searchParams.get('acr_values'), 'idp:sbid')
    promptedForBankID = !ssoActive || searchParams.get('prompt') === 'login'
  })
  equal(promptedForBankID, true)
})

Deno.test('Fel från Auth visar fel och lämnar sessionen aktiv tills användaren lyckas logga ut', async () => {
  const messages: string[] = []
  let authAvailable = false
  const userId = '10000000-0000-4000-8000-000000000001'
  const claims = base64url.encode(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 }))
  const { auth } = createClient('https://supabase.example', 'syntetisk-publik-nyckel', {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: async (input, init) => {
      const request = new Request(input, init)
      const { pathname } = new URL(request.url)
      if (pathname === '/auth/v1/user') return Response.json({ id: userId, app_metadata: {} })
      equal(pathname, '/auth/v1/logout')
      return authAvailable
        ? new Response(null, { status: 204 })
        : Response.json({ message: 'syntetiskt tjänstefel' }, { status: 503 })
    } },
  })
  const signOut = () => signOutFromApp(async () => {}, () => auth.signOut(), (message) => messages.push(message))
  const observedUsers: (string | null)[] = []
  const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
    if (event !== 'INITIAL_SESSION') observedUsers.push(session?.user.id ?? null)
  })
  const { error } = await auth.setSession({ access_token: `e30.${claims}.c2ln`, refresh_token: 'syntetisk-refresh' })
  equal(error, null)

  await signOut()
  deepStrictEqual(observedUsers, [userId])
  equal((await auth.getSession()).data.session?.user.id, userId)
  equal(messages.length, 1)
  match(messages[0], /fortfarande är inloggad.*försöka igen/)

  authAvailable = true
  await signOut()
  deepStrictEqual(observedUsers, [userId, null])
  equal((await auth.getSession()).data.session, null)
  equal(messages.length, 1)
  subscription.unsubscribe()
})

Deno.test('Avtalets BankID-avslag låser bara den tidigare verifierade sessionen och begär ny verifiering', async () => {
  const user = { id: 'test-konto', app_metadata: { bankid_session_id: 'ny-session' } }
  const handle = withContractAuthorization(() => {
    throw new Error('En ersatt session får inte generera avtal')
  }, async () => ({ data: { user }, error: null }))
  const claims = base64url.encode(JSON.stringify({ sub: user.id, role: 'authenticated', session_id: 'tidigare-session' }))
  const response = await handle(new Request('https://edge.example/generate-contract', {
    headers: { Authorization: `Bearer header.${claims}.syntetisk-signatur` },
  }))

  const rejected: string[] = []
  equal(await handleBankIDRejection(response, 'tidigare-session', (id) => rejected.push(id)), true)
  deepStrictEqual(rejected, ['tidigare-session'])
  const otherError = Response.json({ code: 'annan_orsak' }, { status: 403 })
  equal(await handleBankIDRejection(otherError, 'ny-session', (id) => rejected.push(id)), false)
  deepStrictEqual(rejected, ['tidigare-session'])
})
