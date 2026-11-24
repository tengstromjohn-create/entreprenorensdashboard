import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { getRoaringCredentials, getRoaringToken, fetchEngagements, type EngagementData } from '../_shared/roaring.ts'
import { createSignicatVerifier, InvalidSignicatSession } from './signicat.ts'
import { startBankIDSession } from './session.ts'

async function fetchEngagementsSafe(personalNumber: string): Promise<EngagementData | null> {
  try {
    const creds = getRoaringCredentials()
    if (!creds) return null
    const token = await getRoaringToken(creds.clientId, creds.clientSecret)
    const result = await fetchEngagements(token, personalNumber)
    if (!result.ok || !result.data) throw new Error('Engagemang kunde inte hämtas')
    return result.data
  } catch {
    console.error('[bankid-auth] Bolagsengagemang kunde inte hämtas')
    return null
  }
}

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, 'Cache-Control': 'no-store' },
  })
}

let verifySignicat: ReturnType<typeof createSignicatVerifier> | undefined

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  if (req.method !== 'POST') return json({ error: 'POST krävs' }, 405)

  const body = await req.json().catch(() => null)
  if (typeof body?.idToken !== 'string' || !body.idToken ||
      typeof body.accessToken !== 'string' || !body.accessToken) {
    return json({ error: 'Signicat-token saknas' }, 400)
  }

  try {
    const issuer = Deno.env.get('SIGNICAT_ISSUER') ?? ''
    const audience = Deno.env.get('SIGNICAT_CLIENT_ID') ?? ''
    verifySignicat ??= createSignicatVerifier(issuer, audience)
    const identity = await verifySignicat(body.idToken, body.accessToken)

    const admin = getAdminClient()
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const session = await startBankIDSession(
      admin,
      authClient.auth,
      issuer,
      identity,
      fetchEngagementsSafe,
    )

    return json({ accessToken: session.access_token, refreshToken: session.refresh_token })
  } catch (error) {
    if (error instanceof InvalidSignicatSession) {
      return json({ error: 'Signicat-sessionen kunde inte verifieras' }, 401)
    }
    // Fel från Auth och externa tjänster kan innehålla tokens eller personuppgifter.
    console.error('[bankid-auth] BankID-inloggningen kunde inte slutföras')
    return json({ error: 'BankID-inloggningen kunde inte slutföras. Försök igen.' }, 503)
  }
})
