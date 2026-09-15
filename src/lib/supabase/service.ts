import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Service-role client — bypasses RLS entirely. Used ONLY by routes that run
// with no logged-in user/cookies (the cron reminder route), never anything
// a browser request could reach. SUPABASE_SERVICE_ROLE_KEY is server-only,
// never NEXT_PUBLIC_ — do not import this file from client code.
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
