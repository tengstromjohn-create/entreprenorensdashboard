import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

async function verifyAdmin(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const supabaseAdmin = getAdminClient()
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !user) return null

  // Check admin role
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profile?.role !== 'admin') return null

  return user.id
}

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const adminId = await verifyAdmin(req)
  if (!adminId) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const url = new URL(req.url)
  const path = url.pathname.replace('/admin-api', '')

  try {
    // TODO: ED-6 — Implement admin endpoints
    // Routes:
    //   GET  /users — List all users with trust levels
    //   GET  /users/:id — Get user details
    //   POST /users/:id/verify — Manually verify a user
    //   POST /users/:id/trust-level — Update trust level
    //   GET  /pending-verifications — List pending manual verifications
    //   POST /pending-verifications/:id/approve — Approve verification
    //   POST /pending-verifications/:id/reject — Reject verification
    //   GET  /activity — Activity log
    //   GET  /stats — Platform statistics

    // Log admin action
    const supabaseAdmin = getAdminClient()
    await supabaseAdmin.from('activity_log').insert({
      user_id: adminId,
      action: 'admin_api_call',
      metadata: { path, method: req.method },
    })

    return new Response(
      JSON.stringify({
        message: `Admin API endpoint ${path} coming in ED-6.`,
        available_endpoints: [
          'GET /users',
          'GET /users/:id',
          'POST /users/:id/verify',
          'POST /users/:id/trust-level',
          'GET /pending-verifications',
          'POST /pending-verifications/:id/approve',
          'POST /pending-verifications/:id/reject',
          'GET /activity',
          'GET /stats',
        ],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
