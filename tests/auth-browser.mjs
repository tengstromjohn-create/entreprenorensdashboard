import { deepStrictEqual, equal } from 'node:assert/strict'
import { chromium } from 'npm:playwright@1.58.2'

const baseURL = Deno.env.get('AUTH_BROWSER_URL') ?? 'http://127.0.0.1:5173'
const fixture = `${baseURL}/tests/auth-browser.html`
const authKey = 'sb-supabase-auth-token'
const companyKey = 'grundat_active_company'
const companyName = 'Syntetiskt testbolag'

function makeSession(userId, sessionId, { bankID = false, rotation = 0 } = {}) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const claims = btoa(JSON.stringify({ sub: userId, session_id: sessionId, exp, rotation })).replace(/=+$/, '')
  return {
    access_token: `e30.${claims}.c2ln`,
    refresh_token: `syntetisk-${sessionId}-${rotation}`,
    expires_at: exp,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      aud: 'authenticated',
      app_metadata: bankID ? { bankid_session_id: sessionId } : {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  }
}

async function mockAuth(context, sessions, rotated) {
  let refreshed = false
  await context.route('https://supabase.example/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
    }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (path === '/rest/v1/user_profiles') return route.fulfill({ json: null, headers })
    if (path === '/auth/v1/user') {
      const session = sessions.find(({ access_token }) => request.headers().authorization === `Bearer ${access_token}`)
      if (session) return route.fulfill({ json: session.user, headers })
    }
    if (path === '/auth/v1/token' && rotated && request.postDataJSON().refresh_token === sessions[0].refresh_token) {
      if (!refreshed) {
        refreshed = true
        return route.fulfill({ json: rotated, headers })
      }
      return route.fulfill({ status: 400, json: { message: 'Syntetisk refresh-token har ersatts' }, headers })
    }
    return route.abort()
  })
}

async function openTab(context) {
  const page = await context.newPage()
  await page.goto(fixture)
  await page.getByTestId('account').waitFor()
  return page
}

async function expectAccount(page, account) {
  await page.getByTestId('account').filter({ hasText: new RegExp(`^${account}$`) }).waitFor()
}

async function signIn(page, session) {
  const result = await page.evaluate((tokens) => window.authTest.auth.setSession(tokens), session)
  equal(result.error, null)
  await expectAccount(page, session.user.id)
}

async function testBankIDIsolation(context) {
  const original = makeSession('konto-bankid', 'bankid-session', { bankID: true })
  const rotated = makeSession('konto-bankid', 'bankid-session', { bankID: true, rotation: 1 })
  await mockAuth(context, [original], rotated)
  await context.addInitScript((key) => {
    window.sentAuthSessions = []
    window.sharedAuthChanges = []
    const postMessage = BroadcastChannel.prototype.postMessage
    BroadcastChannel.prototype.postMessage = function (message) {
      if (message.session) window.sentAuthSessions.push({ channel: this.name, event: message.event })
      return postMessage.call(this, message)
    }
    window.addEventListener('storage', (event) => {
      if (event.key === key) window.sharedAuthChanges.push(event.newValue)
    })
  }, authKey)

  const observer = await openTab(context)
  const verified = await openTab(context)
  await expectAccount(observer, 'utloggad')
  await signIn(verified, original)
  await observer.waitForFunction(() => window.sharedAuthChanges.length === 1)

  // En flik med opener börjar med en kopia av sessionStorage.
  const popup = verified.waitForEvent('popup')
  await verified.evaluate(() => { window.open(location.href) })
  const copied = await popup
  await expectAccount(copied, original.user.id)

  equal((await verified.evaluate(() => window.authTest.auth.refreshSession())).data.session?.access_token, rotated.access_token)
  deepStrictEqual(await verified.evaluate(() => window.sentAuthSessions), [])
  deepStrictEqual(await observer.evaluate(() => window.sharedAuthChanges.map(JSON.parse)), [{ bankIDSessionId: 'bankid-session' }])
  equal(await observer.evaluate(() => window.authTest.sdkEvents.some(({ userId }) => !!userId)), false)
  equal(await observer.evaluate(() => !!window.authTest.realtimeToken()), false)
  equal((await observer.evaluate(() => window.authTest.auth.getSession())).data.session, null)

  // Omladdning läser den förnyade sessionen ur samma fliks lagring.
  await verified.reload()
  await expectAccount(verified, original.user.id)
  equal((await verified.evaluate(() => window.authTest.auth.getSession())).data.session?.access_token, rotated.access_token)

  // Den kopierade fliken har kvar den gamla refresh-tokenen och behöver verifieras igen.
  equal((await copied.evaluate(() => window.authTest.auth.getSession())).data.session?.refresh_token, original.refresh_token)
  equal(await copied.evaluate(async () => (await window.authTest.auth.refreshSession()).error?.status), 400)
  await expectAccount(copied, 'utloggad')
  await expectAccount(verified, 'utloggad')
}

async function testQueuedAccountChanges(context, bankID) {
  const firstAccount = makeSession('konto-a', 'session-a', { bankID })
  const otherAccount = makeSession('konto-b', 'session-b')
  await mockAuth(context, [firstAccount, otherAccount])
  const receiver = await openTab(context)
  const writer = await openTab(context)
  await signIn(receiver, firstAccount)

  await receiver.getByRole('button', { name: 'Välj testbolag' }).click()
  await receiver.getByTestId('company').filter({ hasText: companyName }).waitFor()
  await receiver.getByRole('button', { name: 'Starta bolagsuppslag' }).click()
  if (bankID) {
    await receiver.getByRole('button', { name: 'Öppna avtalsmotorn' }).click()
    await receiver.getByRole('button', { name: /Sekretessavtal/ }).click()
    equal(await receiver.getByPlaceholder('AB Företaget').inputValue(), companyName)
  }

  // Köa Chromiums riktiga lagringshändelser så att providern får båda efter
  // den sista skrivningen, även om flikarna kör i olika processer.
  await receiver.evaluate((key) => {
    window.observedAccountChanges = []
    window.deferredAccountChanges = []
    window.deferAccountChanges = false
    window.addEventListener('storage', (event) => {
      if (event.key !== key) return
      if (window.deferAccountChanges) {
        event.stopImmediatePropagation()
        window.deferredAccountChanges.push(new StorageEvent('storage', event))
        return
      }
      window.observedAccountChanges.push({
        oldValue: event.oldValue,
        newValue: event.newValue,
        current: localStorage.getItem(key),
      })
    }, { capture: true })
  }, authKey)
  const firstValue = bankID ? { bankIDSessionId: 'session-a' } : firstAccount
  if (!bankID) {
    const renewed = makeSession('konto-a', 'session-a', { rotation: 1 })
    await writer.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: authKey, value: renewed })
    await receiver.waitForFunction(() => window.observedAccountChanges.length === 1)
    await receiver.waitForFunction((token) => window.authTest.realtimeToken() === token, renewed.access_token)
    equal(await receiver.getByTestId('company').textContent(), companyName)
    equal(await receiver.evaluate((key) => !!sessionStorage.getItem(key), companyKey), true)
    await receiver.evaluate(() => { window.observedAccountChanges.length = 0 })
  }
  await receiver.evaluate(() => { window.deferAccountChanges = true })
  await writer.evaluate(({ key, next, final }) => {
    localStorage.setItem(key, JSON.stringify(next))
    localStorage.setItem(key, JSON.stringify(final))
  }, { key: authKey, next: otherAccount, final: firstValue })
  await receiver.waitForFunction(() => window.deferredAccountChanges.length === 2)
  await receiver.evaluate(() => {
    window.deferAccountChanges = false
    for (const event of window.deferredAccountChanges) window.dispatchEvent(event)
  })
  deepStrictEqual(await receiver.evaluate(() => window.observedAccountChanges.map(({ newValue, current }) => [newValue, current])), [
    [JSON.stringify(otherAccount), JSON.stringify(firstValue)],
    [JSON.stringify(firstValue), JSON.stringify(firstValue)],
  ])
  await expectAccount(receiver, firstAccount.user.id)
  await receiver.getByTestId('company').filter({ hasText: 'inget bolag' }).waitFor()
  await receiver.getByRole('button', { name: 'Slutför bolagsuppslag' }).click()
  equal(await receiver.getByTestId('company').textContent(), 'inget bolag')
  equal(await receiver.evaluate((key) => sessionStorage.getItem(key), companyKey), null)
  if (bankID) {
    await receiver.getByRole('button', { name: /Sekretessavtal/ }).click()
    equal(await receiver.getByPlaceholder('AB Företaget').inputValue(), '')
  }
}

const browser = await chromium.launch()
try {
  for (const [name, run] of [
    ['F21 och F20: isolering, förnyelse, omladdning och kopierad flik', testBankIDIsolation],
    ['F22: köat A → B → A i providern, även med ett pågående bolagsuppslag', (context) => testQueuedAccountChanges(context, false)],
    ['F19: köat BankID-kontobyte rensar öppet NDA och tidigare förifyllnad', (context) => testQueuedAccountChanges(context, true)],
  ]) {
    const context = await browser.newContext()
    try {
      await run(context)
      console.log(`Godkänt – ${name}`)
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}
