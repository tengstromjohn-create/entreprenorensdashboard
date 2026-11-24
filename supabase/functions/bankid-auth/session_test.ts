import { deepStrictEqual, equal, rejects } from 'node:assert/strict'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { base64url } from 'npm:jose@6.2.16'
import { startBankIDSession } from './session.ts'

const issuer = 'https://signicat.example/auth/open'
const identity = { subject: 'testidentitet', name: 'Testanvändare', personalNumber: '200001010000' }
const sessionId = '10000000-0000-4000-8000-000000000002'

function mockAuth({ failBinding = false, wrongLinkUser = false, failLookup = false } = {}) {
  type Account = { id: string; email: string; app_metadata: Record<string, unknown> }
  let account: Account | undefined
  let created = 0
  let exchanged = 0
  const profiles: Record<string, unknown>[] = []

  const mockFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    const path = new URL(request.url).pathname
    const method = request.method
    if (method === 'GET' && path.startsWith('/auth/v1/admin/users/')) {
      if (failLookup) return Response.json({ message: 'Auth Service Unavailable' }, { status: 500 })
      if (account) {
        equal(path, `/auth/v1/admin/users/${account.id}`)
        return Response.json(account)
      }
      return Response.json({ message: 'User not found' }, { status: 404 })
    }
    if (method === 'POST' && path === '/auth/v1/admin/users') {
      account = await request.json()
      created++
      return Response.json(account)
    }
    if (method === 'POST' && path === '/rest/v1/user_profiles') {
      profiles.push(await request.json())
      return new Response(null, { status: 201 })
    }
    if (!account) throw new Error('Det verifierade kontot saknas')
    if (method === 'POST' && path === '/auth/v1/admin/generate_link') {
      equal((await request.json()).email, account.email)
      return Response.json({
        ...account,
        id: wrongLinkUser ? 'annat-konto' : account.id,
        hashed_token: 'syntetiskt-engångsbevis',
        verification_type: 'magiclink',
      })
    }
    if (method === 'POST' && path === '/auth/v1/verify') {
      equal((await request.json()).token_hash, 'syntetiskt-engångsbevis')
      exchanged++
      const claims = { sub: account.id, session_id: sessionId, role: 'authenticated' }
      return Response.json({
        access_token: `${base64url.encode('{}')}.${base64url.encode(JSON.stringify(claims))}.signature`,
        refresh_token: 'syntetisk-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: account,
      })
    }
    if (method === 'PUT' && path === `/auth/v1/admin/users/${account.id}`) {
      if (failBinding) return Response.json({ message: 'Auth Service Unavailable' }, { status: 500 })
      const { app_metadata } = await request.json()
      account.app_metadata = { ...account.app_metadata, ...app_metadata }
      return Response.json(account)
    }
    throw new Error(`Oväntat anrop ${method} ${path}`)
  }

  const options = {
    global: { fetch: mockFetch },
    auth: { autoRefreshToken: false, persistSession: false },
  }
  const admin = createClient('https://supabase.example', 'syntetisk-service-nyckel', options)
  const { auth } = createClient('https://supabase.example', 'syntetisk-publik-nyckel', options)
  return {
    login: () => startBankIDSession(admin, auth, issuer, identity, async (personalNumber) => {
      equal(personalNumber, identity.personalNumber)
      return null
    }),
    results: () => ({ account, created, exchanged, profiles }),
  }
}

Deno.test('BankID-inloggning sparar verifierat session-id och återanvänder samma Supabase-konto', async () => {
  const { login, results } = mockAuth()
  const first = await login()
  const second = await login()
  const { account, created, exchanged, profiles } = results()
  equal(first.user.id, second.user.id)
  equal(first.user.id, account?.id)
  equal(account?.app_metadata.bankid_session_id, sessionId)
  equal(created, 1)
  equal(exchanged, 2)
  const profile = { id: first.user.id, display_name: identity.name, email: account?.email }
  deepStrictEqual(profiles, [profile, profile])
})

Deno.test('BankID-inloggning returnerar inga sessionstoken om verifieringen inte kan sparas', async () => {
  const { login, results } = mockAuth({ failBinding: true })
  await rejects(login(), /Auth Service Unavailable/)
  equal(results().account?.app_metadata.bankid_session_id, undefined)
})

Deno.test('BankID-inloggning löser inte in en länk utställd till ett annat konto', async () => {
  const { login, results } = mockAuth({ wrongLinkUser: true })
  await rejects(login(), /Inloggningslänken gäller ett annat konto/)
  equal(results().exchanged, 0)
})

Deno.test('BankID-inloggning skiljer ett Auth-fel från ett saknat konto', async () => {
  const { login, results } = mockAuth({ failLookup: true })
  await rejects(login(), /Auth Service Unavailable/)
  equal(results().created, 0)
})
