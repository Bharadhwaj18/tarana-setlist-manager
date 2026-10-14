import { cache } from 'react'
import type { AuthError, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * The signed-in user for this request, shared by the layout and the page.
 *
 * The middleware already confirmed this request's session with Supabase's auth server, so here
 * we only need to read who it is. getClaims() checks the token's signature locally (no network)
 * when the project uses asymmetric JWT keys, and quietly falls back to asking Supabase when it
 * can't. The one trade-off: a session revoked in the last few minutes still reads as valid until
 * its token expires, but the middleware check on the same request keeps the gate itself strict.
 */
export const getCachedUser = cache(async (): Promise<{ data: { user: User | null }; error: AuthError | null }> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (claims?.sub) {
    const user = {
      id: claims.sub,
      email: claims.email,
      aud: 'authenticated',
      app_metadata: claims.app_metadata ?? {},
      user_metadata: claims.user_metadata ?? {},
      created_at: '',
    } as unknown as User
    return { data: { user }, error: null }
  }
  return { data: { user: null }, error: error as AuthError | null }
})
