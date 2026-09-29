import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// getUser() makes a real network round-trip to Supabase's auth server to
// verify the token (unlike getSession(), which just reads the local JWT).
// Middleware, the (app) layout, and every page all call it — without this,
// that's 3+ separate round-trips for a single navigation. cache() collapses
// every call within one request/render pass into the one already in flight.
export const getCachedUser = cache(async () => {
  const supabase = await createClient()
  return supabase.auth.getUser()
})
