import { deepStrictEqual, equal, match, rejects } from 'node:assert/strict'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { base64url } from 'npm:jose@6.2.16'
import { fetchEngagementsSafe, readBankIDProfileDetails } from './profile.ts'
import { startBankIDSession } from './session.ts'

const identity = { subject: 'test-subject', name: 'Testanvändare', personalNumber: '200001010000' }
const issuer = 'https://signicat.example/auth/open'
const sessionId = '10000000-0000-4000-8000-000000000002'

function profileFixture({ flagged = false, registryError = false, existingClient = false } = {}) {
  let account: { id: string; email: string; app_metadata: Record<string, unknown> } | undefined
  let persisted: Record<string, unknown> | undefined
  let links = 0
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const req = new Request(input, init)
    const { pathname, searchParams } = new URL(req.url)
    const { method } = req
    if (method === 'GET' && pathname.startsWith('/auth/v1/admin/users/')) {
      return Response.json({ message: 'User not found' }, { status: 404 })
    }
    if (method === 'POST' && pathname === '/auth/v1/admin/users') {
      account = await req.json()
      return Response.json(account)
    }
    if (method === 'GET' && pathname === '/rest/v1/conflict_check_registry') {
      deepStrictEqual(Object.fromEntries(searchParams), {
        select: 'id', personal_number: `eq.${identity.personalNumber}`, is_active: 'eq.true', limit: '1',
      })
      if (registryError) return Response.json({ message: 'register unavailable' }, { status: 500 })
      return Response.json(flagged ? [{ id: 'syntetisk-träff' }] : [])
    }
    if (!account) throw new Error('Verifierat konto saknas i testet')
    if (method === 'GET' && pathname === '/rest/v1/user_profiles') {
      deepStrictEqual(Object.fromEntries(searchParams), { select: 'trust_level', id: `eq.${account.id}` })
      return Response.json(existingClient ? [{ trust_level: 'existing_client' }] : [])
    }
    if (method === 'POST' && pathname === '/rest/v1/user_profiles') {
      persisted = await req.json()
      return new Response(null, { status: 201 })
    }
    if (method === 'POST' && pathname === '/auth/v1/admin/generate_link') {
      links++
      return Response.json({ ...account, hashed_token: 'syntetisk-kod' })
    }
    if (method === 'POST' && pathname === '/auth/v1/verify') {
      const claims = base64url.encode(JSON.stringify({ sub: account.id, session_id: sessionId, role: 'authenticated' }))
      return Response.json({
        user: account, access_token: `header.${claims}.signatur`, refresh_token: 'syntetisk-refresh', expires_in: 3600,
      })
    }
    if (method === 'PUT' && pathname === `/auth/v1/admin/users/${account.id}`) {
      return Response.json(account)
    }
    throw new Error(`Oväntat anrop ${method} ${pathname}`)
  }

  const options = { global: { fetch }, auth: { autoRefreshToken: false, persistSession: false } }
  const admin = createClient('https://supabase.example', 'syntetisk-service-nyckel', options)
  const { auth } = createClient('https://supabase.example', 'syntetisk-publik-nyckel', options)
  return {
    login: () => startBankIDSession(admin, auth, issuer, identity, (personalNumber, userId) =>
      readBankIDProfileDetails(admin, personalNumber, userId, async () => null)),
    outcome: () => ({ persisted, links }),
  }
}

Deno.test('BankID sparar träff eller klar jävsstatus och återställer profilfält på det verifierade kontot', async () => {
  for (const flagged of [true, false]) {
    const { login, outcome } = profileFixture({ flagged, existingClient: flagged })
    const session = await login()
    const { persisted, links } = outcome()
    equal(persisted?.id, session.user.id)
    equal(persisted?.conflict_check_result, flagged ? 'flagged' : 'clear')
    equal(persisted?.trust_level, flagged ? 'existing_client' : 'bankid')
    equal(persisted?.bankid_verified_at, persisted?.conflict_checked_at)
    match(String(persisted?.conflict_checked_at), /^\d{4}-\d{2}-\d{2}T/)
    match(String(persisted?.personal_number_hash), /^[a-f0-9]{64}$/)
    equal(JSON.stringify(persisted).includes(identity.personalNumber), false)
    equal(links, 1)
  }
})

Deno.test('Jävsregisterfel godkänner ingen kontroll och lämnar inte ut någon session', async () => {
  const { login, outcome } = profileFixture({ registryError: true })
  await rejects(login(), /Jävskontrollen misslyckades/)
  deepStrictEqual(outcome(), { persisted: undefined, links: 0 })
})

Deno.test('Roaring utan konfiguration ger en driftindikering, medan avstängt Roaring hoppas över', async () => {
  const warnings: unknown[][] = []
  const warn = console.warn
  console.warn = (...args) => warnings.push(args)
  try {
    equal(await fetchEngagementsSafe(identity.personalNumber, false, () => null), null)
    equal(await fetchEngagementsSafe(identity.personalNumber, true, () => {
      throw new Error('Avstängd integration får inte läsa credentials')
    }), null)
  } finally {
    console.warn = warn
  }
  deepStrictEqual(warnings, [['[bankid-auth] Roaring-konfiguration saknas för bolagsengagemang']])
})
