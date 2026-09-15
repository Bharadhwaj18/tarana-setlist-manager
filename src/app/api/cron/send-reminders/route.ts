import { NextRequest, NextResponse } from 'next/server'

// Runs once/day (Vercel Hobby-tier cron limit — see vercel.json) to send
// due-date reminders. Phase 1 ships this as a reachable, secured no-op;
// Phase 2 fills in the actual notes.due_date query once that column
// exists. No logged-in user/cookies are available here — anything this
// route needs from the DB must go through the service-role client
// (src/lib/supabase/service.ts), never the cookie-based one.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ ok: true, sent: 0 })
}
