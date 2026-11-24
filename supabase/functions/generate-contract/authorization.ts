import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getVerifiedSessionId } from '../_shared/bankid-session.ts'

type GetUser = (token: string) => Promise<{
  data: { user: { id: string; app_metadata: Record<string, unknown> } | null }
  error: { status?: number } | null
}>

function reject(status: number, error: string, code: string): Response {
  return Response.json({ error, code }, { status, headers: corsHeaders })
}

export function withContractAuthorization(
  handleContract: (req: Request, userId: string) => Promise<Response>,
  getUser: GetUser,
) {
  return async (req: Request) => {
    const corsResponse = handleCors(req)
    if (corsResponse) return corsResponse

    const token = req.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1]
    const unauthorized = () => reject(401, 'Giltig inloggning krävs', 'session_required')
    if (!token) return unauthorized()

    let userId: string
    try {
      const { data: { user }, error } = await getUser(token)
      if (error) {
        if (error.status && [400, 401, 403, 404].includes(error.status)) return unauthorized()
        throw error
      }
      if (!user) return unauthorized()

      const sessionId = getVerifiedSessionId(token, user.id)
      if (!sessionId) return unauthorized()
      if (user.app_metadata.bankid_session_id !== sessionId) {
        return reject(403, 'BankID-verifiering krävs för att generera avtal', 'trust_level_required')
      }
      userId = user.id
    } catch {
      console.error('[generate-contract] Supabase-sessionen kunde inte verifieras')
      return reject(503, 'Inloggningen kunde inte kontrolleras. Försök igen.', 'auth_unavailable')
    }

    return handleContract(req, userId)
  }
}
