import { base64url } from 'npm:jose@6.2.16'
import { getVerifiedSessionId } from '../_shared/bankid-session.ts'
import type { getAdminClient } from '../_shared/supabase-admin.ts'
import type { BankIDProfileDetails } from './profile.ts'
import type { BankIDIdentity } from './signicat.ts'

type AdminClient = ReturnType<typeof getAdminClient>

async function accountKey(issuer: string, subject: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify([issuer, subject])),
  )
  const bytes = new Uint8Array(digest)
  const key = base64url.encode(bytes)
  // Ett stabilt UUID låter Auth slå upp kontot direkt även när dess e-post ändrats.
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes.subarray(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  return { id, key }
}

export async function startBankIDSession(
  admin: AdminClient,
  auth: Pick<AdminClient['auth'], 'verifyOtp'>,
  issuer: string,
  identity: BankIDIdentity,
  getProfileDetails: (personalNumber: string, userId: string) => Promise<BankIDProfileDetails | null>,
) {
  const { id, key } = await accountKey(issuer, identity.subject)
  const { data: existing, error: lookupError } = await admin.auth.admin.getUserById(id)
  if (lookupError && lookupError.status !== 404) throw lookupError

  let user = existing?.user
  if (!user) {
    const attributes = {
      id,
      email: `bankid-${key.toLowerCase()}@bankid.invalid`,
      email_confirm: true,
      user_metadata: { display_name: identity.name },
      app_metadata: { bankid_identity_key: key },
    }
    const { data, error } = await admin.auth.admin.createUser(attributes)
    if (error) {
      // En parallell inloggning kan redan ha skapat samma konto.
      const { data: retry, error: retryError } = await admin.auth.admin.getUserById(id)
      if (retryError || !retry.user) throw error
      user = retry.user
    } else {
      user = data.user
    }
  }

  if (user?.id !== id || user.app_metadata.bankid_identity_key !== key || !user.email) {
    throw new Error('Supabase-kontot matchar inte verifierad BankID-identitet')
  }

  const profileDetails = await getProfileDetails(identity.personalNumber, id)
  const { error: profileError } = await admin.from('user_profiles').upsert({
    id,
    display_name: identity.name,
    email: user.email,
    ...profileDetails,
  })
  if (profileError) throw profileError

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  })
  if (linkError) throw linkError
  if (link.user.id !== id) throw new Error('Inloggningslänken gäller ett annat konto')

  const { data: login, error: loginError } = await auth.verifyOtp({
    type: 'email',
    token_hash: link.properties.hashed_token,
  })
  if (loginError) throw loginError
  if (!login.session || login.user?.id !== id) throw new Error('Supabase-sessionen saknas')

  const sessionId = getVerifiedSessionId(login.session.access_token, id)
  if (!sessionId) throw new Error('Supabase-sessionen saknar session-id')

  const { error: bindError } = await admin.auth.admin.updateUserById(id, {
    app_metadata: { bankid_session_id: sessionId },
  })
  if (bindError) throw bindError

  return login.session
}
