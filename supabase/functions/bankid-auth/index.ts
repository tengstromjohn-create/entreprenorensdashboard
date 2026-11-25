import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { createBankIDHandler } from './handler.ts'
import { fetchEngagementsSafe, readBankIDProfileDetails } from './profile.ts'
import { startBankIDSession } from './session.ts'
import { createSignicatVerifier } from './signicat.ts'

const getIssuer = () => Deno.env.get('SIGNICAT_ISSUER') ?? ''
let verifySignicat: ReturnType<typeof createSignicatVerifier> | undefined

serve(createBankIDHandler((proof) => {
  verifySignicat ??= createSignicatVerifier(getIssuer(), Deno.env.get('SIGNICAT_CLIENT_ID') ?? '')
  return verifySignicat(proof)
}, (identity) => {
  const admin = getAdminClient()
  const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const roaringDisabled = Deno.env.get('BANKID_ROARING_ENABLED') === 'false'
  return startBankIDSession(admin, authClient.auth, getIssuer(), identity, (personalNumber, userId) =>
    readBankIDProfileDetails(admin, personalNumber, userId, (verifiedNumber) =>
      fetchEngagementsSafe(verifiedNumber, roaringDisabled),
    ),
  )
}))
