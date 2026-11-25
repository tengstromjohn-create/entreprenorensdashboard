import { deepStrictEqual, equal } from 'node:assert/strict'
import { createClient } from 'npm:@supabase/supabase-js@2.97.0'
import { base64url } from 'npm:jose@6.2.16'
import { InMemoryWebStorage } from 'npm:oidc-client-ts@3.4.1'
import { getCompanyPrefill, readActiveCompany, storeActiveCompany } from '../src/lib/active-company.ts'
import { createAuthStorage, getBankIDSessionId } from '../src/lib/auth-storage.ts'

const authKey = 'sb-supabase-auth-token'

function sessionFor(userId: string, sessionId: string, bankID: boolean) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const claims = base64url.encode(JSON.stringify({ sub: userId, exp: expiresAt, session_id: sessionId }))
  return {
    access_token: `e30.${claims}.c2ln`,
    refresh_token: `refresh-${sessionId}`,
    expires_at: expiresAt,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      aud: 'authenticated',
      app_metadata: bankID ? { bankid_identity_key: `person-${userId}`, bankid_session_id: sessionId } : {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  }
}

type TestSession = ReturnType<typeof sessionFor>

function openTab(shared: InMemoryWebStorage, tab: InMemoryWebStorage, session: TestSession) {
  const storage = createAuthStorage(authKey, shared, tab)
  const { auth } = createClient('https://supabase.example', 'syntetisk-publik-nyckel', {
    auth: { storage, storageKey: authKey, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const request = new Request(input, init)
      const { pathname } = new URL(request.url)
      if (pathname === '/auth/v1/user') {
        equal(request.headers.get('authorization'), `Bearer ${session.access_token}`)
        return Response.json(session.user)
      }
      equal(pathname, '/auth/v1/token')
      equal((await request.json()).refresh_token, session.refresh_token)
      return Response.json(session)
    } },
  })
  return { auth, storage }
}

Deno.test('F17: BankID förnyas och överlever omladdning i samma flik men kräver ny verifiering i en ny webbläsarsession', async () => {
  const shared = new InMemoryWebStorage()
  const tab = new InMemoryWebStorage()
  const emptyTab = new InMemoryWebStorage()
  const verified = sessionFor('bankid-konto', 'verifierad-session', true)

  shared.setItem(authKey, JSON.stringify(verified))
  const afterUpdate = openTab(shared, emptyTab, verified)
  equal((await afterUpdate.auth.getSession()).data.session, null)
  equal(shared.getItem(authKey), null)

  const original = openTab(shared, tab, verified)
  equal((await original.auth.setSession(verified)).error, null)
  equal((await original.auth.refreshSession()).error, null)
  deepStrictEqual(JSON.parse(shared.getItem(authKey)!), { bankIDSessionId: 'verifierad-session' })

  const reloaded = openTab(shared, tab, verified)
  equal(getBankIDSessionId((await reloaded.auth.getSession()).data.session), 'verifierad-session')
  const newBrowserSession = openTab(shared, emptyTab, verified)
  equal((await newBrowserSession.auth.getSession()).data.session, null)
  equal(newBrowserSession.storage.readSession(), null)
  equal(getBankIDSessionId(reloaded.storage.readSession()), 'verifierad-session')
})

Deno.test('F18: kontobyte i en flik rensar tidigare bolagsval och avtalsförifyllnad i båda flikarna', async () => {
  const shared = new InMemoryWebStorage()
  const firstTab = new InMemoryWebStorage()
  const secondTab = new InMemoryWebStorage()
  const previous = sessionFor('tidigare-konto', 'tidigare-session', false)
  const next = sessionFor('nytt-konto', 'ny-session', true)
  const first = openTab(shared, firstTab, previous)
  const second = openTab(shared, secondTab, next)
  const oldCompany = { name: 'Tidigare testbolag', orgNumber: '000000-0001', address: 'Första testvägen 1' }
  const newEngagement = { companyName: 'Nya testbolaget', orgNumber: '000000-0002', roles: [] }

  equal((await first.auth.setSession(previous)).error, null)
  for (const tab of [firstTab, secondTab]) storeActiveCompany(tab, previous.user.id, oldCompany)
  equal((await second.auth.getSession()).data.session?.user.id, previous.user.id)
  equal(getCompanyPrefill(readActiveCompany(secondTab, previous.user.id)).name, oldCompany.name)

  // Kontobyte i den andra fliken. Båda flikarna läser den session som gäller där.
  equal((await second.auth.setSession(next)).error, null)
  const firstUserId = first.storage.readSession()?.user.id
  const secondUserId = second.storage.readSession()?.user.id
  equal(firstUserId, undefined)
  equal(secondUserId, next.user.id)
  equal(readActiveCompany(firstTab, firstUserId), null)
  deepStrictEqual(getCompanyPrefill(readActiveCompany(secondTab, secondUserId), newEngagement), {
    name: newEngagement.companyName, orgNumber: newEngagement.orgNumber, address: '',
  })
  equal(readActiveCompany(firstTab, previous.user.id), null)
  equal(readActiveCompany(secondTab, previous.user.id), null)
})
