import { decodeJwt } from 'npm:jose@6.2.16'

// Anropa först efter att Supabase Auth har verifierat just den här tokenen.
export function getVerifiedSessionId(token: string, userId: string): string | null {
  const claims = decodeJwt(token)
  return claims.sub === userId && claims.role === 'authenticated' &&
    typeof claims.session_id === 'string' && claims.session_id.length > 0
    ? claims.session_id
    : null
}
