/**
 * Defensiv extraktion av BankID-claims ur ett OIDC id_token.
 *
 * Signicat levererar personnumret i "nin" (scope "nin") och namnet via scope
 * "profile". Olika tenanter/uppsättningar använder dock olika claim-namn, så vi
 * prövar flera i prioritetsordning. Personnumret är obligatoriskt; namnet är det
 * inte — inloggningen ska aldrig blockeras på saknat namn.
 */
export interface BankIDClaims {
  personalNumber: string
  name: string
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export function extractBankIDClaims(profile: Record<string, unknown>): BankIDClaims {
  const personalNumber =
    str(profile.nin) ||
    str(profile.personalNumber) ||
    str(profile['signicat.national_id']) ||
    (/^\d{10,12}$/.test(str(profile.sub)) ? str(profile.sub) : '')

  const name =
    str(profile.name) ||
    [str(profile.given_name), str(profile.family_name)].filter(Boolean).join(' ') ||
    'BankID-användare'

  return { personalNumber, name }
}
