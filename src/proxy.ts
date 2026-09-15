import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // api/cron/* is excluded — it authenticates via CRON_SECRET (Vercel's
    // cron invoker has no logged-in session), and would otherwise get
    // redirected to /login by this proxy before its own auth check runs.
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/.*|api/cron/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
