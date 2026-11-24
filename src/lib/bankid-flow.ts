import type { OidcClient } from 'oidc-client-ts'

export function requestBankIDLogin(redirect: (options: {
  acr_values: string
  prompt: string
  nonce: string
  state: string
}) => Promise<void>) {
  const nonce = crypto.randomUUID()
  return redirect({ acr_values: 'idp:sbid', prompt: 'login', nonce, state: nonce })
}

export interface BankIDLoginProof {
  code: string
  codeVerifier: string
  redirectUri: string
  nonce: string
}

export async function readBankIDCallback(oidc: OidcClient, url: string): Promise<BankIDLoginProof> {
  const { response, state } = await oidc.readSigninResponseState(url, true)
  if (response.error || !response.code || response.state !== state.id ||
      state.authority !== oidc.settings.authority || state.client_id !== oidc.settings.client_id ||
      state.redirect_uri !== oidc.settings.redirect_uri || !state.code_verifier ||
      typeof state.data !== 'string' || !state.data) {
    throw new Error('Ogiltigt BankID-svar.')
  }
  return { code: response.code, codeVerifier: state.code_verifier, redirectUri: state.redirect_uri, nonce: state.data }
}

export async function signOutFromApp(
  removeBankIDUser: () => Promise<void>,
  signOut: () => Promise<{ error: unknown }>,
  showError: (message: string) => void,
) {
  try {
    await removeBankIDUser()
    const { error } = await signOut()
    if (error) throw error
  } catch {
    showError('Utloggningen misslyckades. Om du fortfarande är inloggad kan du försöka igen.')
  }
}

export async function handleBankIDRejection(
  response: Response | undefined,
  sessionId: string | null,
  rejectSession: (sessionId: string) => void,
): Promise<boolean> {
  if (response?.status !== 403 || !sessionId) return false
  const body = await response.json().catch(() => null)
  if (body?.code !== 'trust_level_required') return false
  rejectSession(sessionId)
  return true
}
