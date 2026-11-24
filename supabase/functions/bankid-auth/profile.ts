import type { getAdminClient } from '../_shared/supabase-admin.ts'
import { getRoaringCredentials, getRoaringToken, fetchEngagements, type EngagementData } from '../_shared/roaring.ts'

export interface BankIDProfileDetails {
  trust_level: 'bankid' | 'existing_client'
  personal_number_hash: string
  bankid_verified_at: string
  conflict_check_result: 'clear' | 'flagged'
  conflict_checked_at: string
  engagements?: EngagementData
}

export async function readBankIDProfileDetails(
  admin: ReturnType<typeof getAdminClient>,
  personalNumber: string,
  userId: string,
  loadEngagements: (personalNumber: string) => Promise<EngagementData | null>,
): Promise<BankIDProfileDetails> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(personalNumber))
  const personalNumberHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const formattedNumber = `${personalNumber.slice(0, -4)}-${personalNumber.slice(-4)}`

  // Kolumnen saknar formatkrav. Sök på klartext med och utan bindestreck
  // samt på samma SHA-256-format som check-conflict använder.
  const { data: conflicts, error: conflictError } = await admin
    .from('conflict_check_registry')
    .select('id')
    .eq('is_active', true)
    .in('personal_number', [personalNumber, formattedNumber, personalNumberHash])
    .limit(1)
  if (conflictError || !conflicts) {
    console.error('[bankid-auth] Jävsregistret kunde inte kontrolleras')
    throw new Error('Jävskontrollen misslyckades')
  }
  const checkedAt = new Date().toISOString()

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('trust_level')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) throw profileError

  const engagements = await loadEngagements(personalNumber)

  return {
    // Profilfälten används för visning. Avtalsgrinden kontrollerar Auth-sessionen.
    trust_level: profile?.trust_level === 'existing_client' ? 'existing_client' : 'bankid',
    personal_number_hash: personalNumberHash,
    bankid_verified_at: checkedAt,
    conflict_check_result: conflicts.length ? 'flagged' : 'clear',
    conflict_checked_at: checkedAt,
    ...(engagements && { engagements }),
  }
}

export async function fetchEngagementsSafe(
  personalNumber: string,
  disabled: boolean,
  readCredentials = getRoaringCredentials,
): Promise<EngagementData | null> {
  if (disabled) return null

  try {
    const creds = readCredentials()
    if (!creds) {
      console.warn('[bankid-auth] Roaring-konfiguration saknas för bolagsengagemang')
      return null
    }
    const token = await getRoaringToken(creds.clientId, creds.clientSecret)
    const result = await fetchEngagements(token, personalNumber)
    if (!result.ok || !result.data) throw new Error('Engagemang kunde inte hämtas')
    return result.data
  } catch {
    console.error('[bankid-auth] Bolagsengagemang kunde inte hämtas')
    return null
  }
}
