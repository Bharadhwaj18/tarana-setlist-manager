import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'
import { safeNextPath } from '@/lib/safe-redirect'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() verifies the token with Supabase's servers.
  // When offline, it fails and returns null. In that case, fall back to
  // getSession() which reads the JWT from the cookie locally — no network needed.
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  let effectiveUser = user
  if (!user && userError) {
    const { data: { session } } = await supabase.auth.getSession()
    effectiveUser = session?.user ?? null
  }

  const pathname = request.nextUrl.pathname
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth')

  // Invite pages are reachable signed-out (they show the band and a sign-in prompt) and signed-in (accept).
  const isPublicRoute = isAuthRoute || pathname.startsWith('/invite/')

  if (!effectiveUser && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (effectiveUser && isAuthRoute) {
    return NextResponse.redirect(new URL(safeNextPath(request.nextUrl.searchParams.get('next')), request.url))
  }

  return supabaseResponse
}
