import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Service-role client — bypasses RLS entirely. Used ONLY where RLS can't
// express the job: the cron reminder route (no logged-in user at all) and
// account deletion (actions/account.ts, which verifies the caller with
// getUser() first and only ever touches that caller's own account).
// SUPABASE_SERVICE_ROLE_KEY is server-only, never NEXT_PUBLIC_ — do not import this file from client code.
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
