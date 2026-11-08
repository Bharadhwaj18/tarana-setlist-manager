import { createServerClient } from '@supabase/ssr'
import { createClient as createTokenClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import type { Database } from '@/types/database'

/** The sign-in token the phone app sends (as "Authorization: Bearer ...") instead of cookies, if this request has one. */
export async function getBearerToken(): Promise<string | null> {
  const match = /^Bearer (.+)$/i.exec((await headers()).get('authorization') ?? '')
  return match ? match[1] : null
}

export async function createClient() {
  // The phone app has no cookies: it signs each request with its token, so everything below still runs as that
  // user and row-level security applies exactly as on the web.
  const token = await getBearerToken()
  if (token) {
    const client = createTokenClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    // There's no saved session to read, so "who is this" defaults to the token.
    const getUser = client.auth.getUser.bind(client.auth)
    client.auth.getUser = (jwt?: string) => getUser(jwt ?? token)
    const getClaims = client.auth.getClaims.bind(client.auth)
    client.auth.getClaims = ((jwt?: string, options?: Parameters<typeof getClaims>[1]) => getClaims(jwt ?? token, options)) as typeof client.auth.getClaims
    return client as unknown as ReturnType<typeof createServerClient<Database>>
  }

  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — safe to ignore
          }
        },
      },
    }
  )
}
