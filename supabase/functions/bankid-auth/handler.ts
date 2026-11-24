import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { InvalidSignicatSession, type BankIDIdentity } from './signicat.ts'

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, 'Cache-Control': 'no-store' },
  })
}

export function createBankIDHandler(
  verifySignicat: (idToken: string, accessToken: string) => Promise<BankIDIdentity>,
  startSession: (identity: BankIDIdentity) => Promise<{ access_token: string; refresh_token: string }>,
) {
  return async (req: Request) => {
    const corsResponse = handleCors(req)
    if (corsResponse) return corsResponse
    if (req.method !== 'POST') return json({ error: 'POST krävs' }, 405)

    const body = await req.json().catch(() => null)
    if (typeof body?.idToken !== 'string' || !body.idToken ||
        typeof body.accessToken !== 'string' || !body.accessToken) {
      return json({ error: 'Signicat-token saknas' }, 400)
    }

    try {
      const identity = await verifySignicat(body.idToken, body.accessToken)
      const session = await startSession(identity)
      return json({ accessToken: session.access_token, refreshToken: session.refresh_token })
    } catch (error) {
      if (error instanceof InvalidSignicatSession) {
        return json({ error: 'Signicat-sessionen kunde inte verifieras' }, 401)
      }
      console.error('[bankid-auth] BankID-inloggningen kunde inte slutföras')
      return json({ error: 'BankID-inloggningen kunde inte slutföras. Försök igen.' }, 503)
    }
  }
}
