/**
 * Delad Roaring-klient för edge functions (Spurt A2, 2026-06-05).
 *
 * OAuth 2.0 client_credentials mot https://api.roaring.io/token.
 * Secrets: ROARING_CLIENT_ID + ROARING_CLIENT_SECRET (Supabase secrets, läses via Deno.env).
 *
 * OBS: lookup-company har en egen (äldre, identisk) kopia av token-logiken —
 * migrera den hit vid nästa touch av den funktionen.
 */

let cachedToken: { value: string; expiresAt: number } | null = null

export function getRoaringCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = Deno.env.get('ROARING_CLIENT_ID')
  const clientSecret = Deno.env.get('ROARING_CLIENT_SECRET')
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export async function getRoaringToken(clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.value
  }

  const basic = btoa(`${clientId}:${clientSecret}`)
  const response = await fetch('https://api.roaring.io/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new Error(`Roaring OAuth token error: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  cachedToken = {
    value: data.access_token,
    expiresAt: now + (data.expires_in * 1000) - 60_000,
  }
  return data.access_token
}

export async function callRoaring<T>(
  token: string,
  path: string
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const response = await fetch(`https://api.roaring.io${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const text = await response.text()
      return { ok: false, status: response.status, error: text }
    }
    return { ok: true, status: response.status, data: await response.json() as T }
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) }
  }
}

// Roaring namnformat: "Efternamn, Förnamn Mellannamn" -> "Förnamn Mellannamn Efternamn"
export function formatPersonName(raw?: string): string {
  if (!raw) return ''
  const [last, first] = raw.split(',').map((s) => s.trim())
  return first ? `${first} ${last}` : last
}

export interface Engagement {
  orgNumber: string
  companyName: string
  roles: string[]
}

export interface EngagementData {
  fetchedAt: string
  source: 'roaring'
  fullName?: string
  items: Engagement[]
}

/**
 * Hämtar en persons bolagsengagemang via Roaring Company Engagements 3.0.
 * Endpoint verifierad mot developer.roaring.io 2026-06-05:
 *   GET /se/company/engagement/3.0/{personalNumber}
 * Svaret är INTE wrappat i records[] — engagements[] ligger på toppnivå
 * tillsammans med fullName, personalNumber, hitCount och status.
 *
 * Rollkoder (urval): 5 = Ledamot, 8 = Revisor, 9 = Revisorssuppleant,
 * 2 = Extern firmatecknare. Vi exkluderar revisorsroller via query-param —
 * en revisor "företräder" inte bolaget i Grundats mening.
 */
export async function fetchEngagements(
  token: string,
  personalNumber: string
): Promise<{ ok: boolean; data?: EngagementData; error?: string }> {
  // Sandbox/test-override: om Supabase-secreten TEST_ENGAGEMENT_PNR är satt används
  // den i stället för det inloggade personnumret. Gör att "Dina bolag" går att demo:a
  // med test-BankID-personer (t.ex. Nisse Entreprenör) som saknar egna engagemang.
  // OBS: avregistrera secreten (`supabase secrets unset TEST_ENGAGEMENT_PNR`) före produktion.
  const override = Deno.env.get('TEST_ENGAGEMENT_PNR')?.replace(/[-\s]/g, '')
  const pnr = override || personalNumber

  // Exkludera revisor (8) och revisorssuppleant (9) direkt i anropet
  const path = `/se/company/engagement/3.0/${pnr}?excludeWithRoleCode=8&excludeWithRoleCode=9`
  const res = await callRoaring<unknown>(token, path)

  if (!res.ok) {
    // 404 = personen finns inte / har inga engagemang — inte ett fel för oss
    if (res.status === 404) {
      return { ok: true, data: { fetchedAt: new Date().toISOString(), source: 'roaring', items: [] } }
    }
    return { ok: false, error: `Roaring engagement-anrop misslyckades: ${res.status} ${res.error}` }
  }

  // deno-lint-ignore no-explicit-any
  const body = res.data as any

  // status.code: 0 = found, 1 = not found (samma mönster som overview)
  if (body?.status?.code !== undefined && body.status.code !== 0) {
    return { ok: true, data: { fetchedAt: new Date().toISOString(), source: 'roaring', items: [] } }
  }

  // deno-lint-ignore no-explicit-any
  const rawEngagements: any[] = body?.engagements ?? []

  const items: Engagement[] = rawEngagements
    .map((e) => {
      const orgNumber: string = String(
        e.companyId ?? e.orgNumber ?? e.organizationNumber ?? e.companyOrgNo ?? ''
      ).replace('-', '')
      const companyName: string = e.companyName ?? e.name ?? e.topCompanyName ?? 'Okänt bolag'
      // Roller kan ligga som e.roles[] eller e.positions[] med roleName/roleText/text
      // deno-lint-ignore no-explicit-any
      const rawRoles: any[] = e.roles ?? e.positions ?? []
      const roles: string[] = rawRoles
        .map((r) => r.roleName ?? r.roleText ?? r.text ?? r.name ?? '')
        .filter(Boolean)
      return { orgNumber, companyName, roles }
    })
    .filter((e) => /^\d{10}$/.test(e.orgNumber))

  return {
    ok: true,
    data: {
      fetchedAt: new Date().toISOString(),
      source: 'roaring',
      fullName: formatPersonName(body?.fullName) || undefined,
      items,
    },
  }
}
