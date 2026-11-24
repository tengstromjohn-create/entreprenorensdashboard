import { base64url, createRemoteJWKSet, customFetch, errors, jwtVerify, type JWTVerifyGetKey } from 'npm:jose@6.2.16'

export class InvalidSignicatSession extends Error {}

export interface BankIDIdentity {
  subject: string
  name: string
  personalNumber: string
}

export interface BankIDLoginProof {
  code: string
  codeVerifier: string
  redirectUri: string
  nonce: string
}

function endpoint(value: unknown, issuer: URL): URL {
  if (typeof value !== 'string') throw new Error('Signicat-endpoint saknas')
  const url = new URL(value)
  if (url.origin !== issuer.origin || url.username || url.password) {
    throw new Error('Signicat-endpoint har fel origin')
  }
  return url
}

export function createSignicatVerifier(issuer: string, audience: string, fetcher = fetch) {
  const issuerUrl = new URL(issuer)
  if (issuerUrl.protocol !== 'https:' || issuerUrl.username || issuerUrl.password || !audience) {
    throw new Error('Ogiltig Signicat-konfiguration')
  }

  async function discover() {
    const response = await fetcher(`${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`, {
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('Signicats konfiguration kunde inte hämtas')
    const metadata = await response.json()
    if (metadata.issuer !== issuer) throw new Error('Signicat-issuer matchar inte konfigurationen')
    return {
      keys: createRemoteJWKSet(endpoint(metadata.jwks_uri, issuerUrl), { [customFetch]: fetcher }),
      tokenUrl: endpoint(metadata.token_endpoint, issuerUrl),
      userInfoUrl: endpoint(metadata.userinfo_endpoint, issuerUrl),
    }
  }

  let discovery: ReturnType<typeof discover> | undefined

  return async ({ code, codeVerifier, redirectUri, nonce }: BankIDLoginProof): Promise<BankIDIdentity> => {
    discovery ??= discover().catch((error) => {
      discovery = undefined
      throw error
    })
    const { keys, tokenUrl, userInfoUrl } = await discovery
    // Signicat löser bara in en kod en gång, även när anropen når olika edge-instanser.
    const tokenResponse = await fetcher(tokenUrl, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: audience,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      }),
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    })

    if (!tokenResponse.ok) {
      if (tokenResponse.status === 400) {
        const failure = await tokenResponse.json().catch(() => null)
        if (failure?.error === 'invalid_grant') throw new InvalidSignicatSession()
      }
      throw new Error('Signicats kodinlösen kunde inte slutföras')
    }
    const { id_token: idToken, access_token: accessToken } = await tokenResponse.json()
    if (typeof idToken !== 'string' || !idToken || typeof accessToken !== 'string' || !accessToken) {
      throw new Error('Signicat returnerade ett ofullständigt tokensvar')
    }

    return verifySignicatSession(idToken, accessToken, issuer, audience, keys, async (token) => {
      const response = await fetcher(userInfoUrl, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      })
      if (response.status === 401 || response.status === 403) throw new InvalidSignicatSession()
      if (!response.ok) throw new Error('Signicat UserInfo svarade med ett fel')
      return response.json()
    }, nonce)
  }
}

export async function verifySignicatSession(
  idToken: string,
  accessToken: string,
  issuer: string,
  audience: string,
  keys: JWTVerifyGetKey,
  getUserInfo: (token: string) => Promise<Record<string, unknown>>,
  expectedNonce?: string,
): Promise<BankIDIdentity> {
  const { payload } = await jwtVerify(idToken, keys, {
    issuer,
    audience,
    algorithms: ['RS256'],
    maxTokenAge: '5m',
    requiredClaims: ['sub', 'exp', 'iat', 'idp'],
  }).catch((error: unknown) => {
    if (error instanceof errors.JOSEError && [
      'ERR_JWT_EXPIRED', 'ERR_JWT_CLAIM_VALIDATION_FAILED', 'ERR_JWT_INVALID',
      'ERR_JWS_INVALID', 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED', 'ERR_JOSE_ALG_NOT_ALLOWED',
      'ERR_JWKS_NO_MATCHING_KEY',
    ].includes(error.code)) throw new InvalidSignicatSession()
    throw error
  })

  if (!payload.sub || payload.idp !== 'sbid' || payload.aud !== audience ||
      (payload.azp !== undefined && payload.azp !== audience) ||
      (expectedNonce !== undefined && payload.nonce !== expectedNonce)) {
    throw new InvalidSignicatSession()
  }

  let info: Record<string, unknown> = payload
  if (payload.at_hash !== undefined) {
    // at_hash binder UserInfo-tokenen till det signerade BankID-svaret (RS256).
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accessToken))
    if (payload.at_hash !== base64url.encode(new Uint8Array(digest).subarray(0, 16))) {
      throw new InvalidSignicatSession()
    }

    info = await getUserInfo(accessToken)
    if (info.sub !== payload.sub) throw new InvalidSignicatSession()
  }

  // at_hash är valfritt i code flow. Utan bindningen används bara signerade claims.
  const nin = info.nin ?? payload.nin
  const personalNumber = typeof nin === 'string' ? nin.replace(/[-\s]/g, '') : ''
  if (!/^(?:\d{10}|\d{12})$/.test(personalNumber)) throw new InvalidSignicatSession()

  const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
  const fullName = (claims: Record<string, unknown>) =>
    [text(claims.given_name), text(claims.family_name)].filter(Boolean).join(' ')
  return {
    subject: payload.sub,
    name: text(info.name) || text(payload.name) || fullName(info) || fullName(payload) || 'BankID-användare',
    personalNumber,
  }
}
