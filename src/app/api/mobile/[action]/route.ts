import { NextResponse } from 'next/server'
import { getBearerToken } from '@/lib/supabase/server'
import * as shows from '@/actions/shows'
import * as setlists from '@/actions/setlists'
import * as songs from '@/actions/songs'
import * as calendarEvents from '@/actions/calendar-events'
import * as unavailability from '@/actions/unavailability'
import * as tasks from '@/actions/tasks'
import * as notes from '@/actions/notes'
import * as finance from '@/actions/finance'
import * as pendingPayments from '@/actions/pending-payments'
import * as eventManagement from '@/actions/event-management'
import * as financeSettings from '@/actions/finance-settings'
import * as financeAccounts from '@/actions/finance-accounts'
import * as financeTransfers from '@/actions/finance-transfers'
import * as financeChecks from '@/actions/finance-checks'
import * as budgets from '@/actions/budgets'

// The phone app runs the same server actions as the website, so validation, notifications, push and approval
// rules stay in one place. Only these modules are reachable, and only with a signed-in user's token.
const MODULES: Record<string, Record<string, unknown>> = { shows, setlists, songs, calendarEvents, unavailability, tasks, notes, finance, pendingPayments, eventManagement, financeSettings, financeAccounts, financeTransfers, financeChecks, budgets }

export const dynamic = 'force-dynamic'

/** POST /api/mobile/<module>.<action> with { args: [...] }, signed with "Authorization: Bearer <token>". */
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  if (!(await getBearerToken())) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const { action } = await params
  const [moduleName, fnName] = action.split('.')
  const fn = MODULES[moduleName]?.[fnName]
  if (typeof fn !== 'function') return NextResponse.json({ error: 'Unknown action' }, { status: 404 })

  let args: unknown[] = []
  try {
    const body = await request.json()
    if (Array.isArray(body?.args)) args = body.args
  } catch { /* no body: call with no arguments */ }

  try {
    return NextResponse.json({ result: (await (fn as (...a: unknown[]) => Promise<unknown>)(...args)) ?? null })
  } catch (e) {
    // A server action that finishes by redirecting (like createShow) throws a redirect: tell the app where it went.
    const digest = (e as { digest?: string } | null)?.digest
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) return NextResponse.json({ result: { redirect: digest.split(';')[2] ?? null } })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Something went wrong' }, { status: 500 })
  }
}
