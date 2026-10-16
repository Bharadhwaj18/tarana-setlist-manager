import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToProfile } from '@/lib/push'
import { todayISO } from '@/lib/shows'
import { addDaysISO, formatDateDMY } from '@/lib/dates'

// Read notifications are cleared after this long; unread ones after a year.
const READ_RETENTION_DAYS = 90
const UNREAD_RETENTION_DAYS = 365
// The furthest ahead a task reminder can be set to fire.
const MAX_REMIND_DAYS = 365

// Runs once/day (Vercel Hobby-tier cron limit — see vercel.json). For every
// task with a due date + a configured reminder lead time (remind_days_before,
// set per-task — no fixed cadence), fires exactly on the day that lead time
// lands on today. No logged-in user/cookies are available in a cron
// invocation, so this uses the service-role client (bypasses RLS) rather
// than the cookie-based one, and writes notifications rows directly instead
// of going through the sendNotification server action (which assumes an
// authenticated actor).
//
// Safe to re-run: each reminder carries a dedupe_key (kind, item, day,
// recipient), so a retry or a second run the same day inserts nothing new and
// pushes nothing twice. All rows go in as one insert.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today = todayISO()

  type Row = { recipient_id: string; workspace_id: string; title: string; body: string | null; link: string; type: string; dedupe_key: string }
  const rows: Row[] = []

  const { data: dueTasks, error: tasksErr } = await supabase
    .from('tasks')
    .select('id, workspace_id, title, created_by, due_date, remind_days_before, assignee_ids')
    .not('remind_days_before', 'is', null)
    .neq('progress', 'completed')
    .gte('due_date', today)
    .lte('due_date', addDaysISO(today, MAX_REMIND_DAYS))
  if (tasksErr) return NextResponse.json({ error: tasksErr.message }, { status: 500 })

  for (const task of dueTasks ?? []) {
    if (addDaysISO(task.due_date!, -task.remind_days_before!) !== today) continue
    const recipientIds = task.assignee_ids.length ? task.assignee_ids : [task.created_by]
    const dueLabel = task.due_date === today ? 'today' : `on ${formatDateDMY(task.due_date!)}`
    for (const recipientId of recipientIds) {
      rows.push({
        recipient_id: recipientId,
        workspace_id: task.workspace_id,
        title: `"${task.title}" is due ${dueLabel}`,
        body: null,
        link: `/tasks?task=${task.id}`,
        type: 'task_due',
        dedupe_key: `task_due:${task.id}:${today}:${recipientId}`,
      })
    }
  }

  // Show reminders — a fixed 3-days-out + day-of pair rather than a
  // per-task lead time, since a show has no single assignee to scope a
  // custom reminder to; every member of the show's workspace gets pinged instead.
  const { data: showRows, error: showsErr } = await supabase
    .from('shows')
    .select('id, title, show_date, venue, workspace_id')
    .in('show_date', [today, addDaysISO(today, 3)])
  if (showsErr) return NextResponse.json({ error: showsErr.message }, { status: 500 })
  const upcomingShows = (showRows ?? []).filter((s): s is typeof s & { workspace_id: string } => !!s.workspace_id)

  if (upcomingShows.length) {
    const { data: members, error: membersErr } = await supabase
      .from('workspace_members')
      .select('workspace_id, user_id')
      .in('workspace_id', [...new Set(upcomingShows.map(s => s.workspace_id))])
    if (membersErr) return NextResponse.json({ error: membersErr.message }, { status: 500 })

    for (const show of upcomingShows) {
      const dueLabel = show.show_date === today ? 'today' : 'in 3 days'
      for (const m of (members ?? []).filter(m => m.workspace_id === show.workspace_id)) {
        rows.push({
          recipient_id: m.user_id,
          workspace_id: show.workspace_id,
          title: `"${show.title}" is ${dueLabel}`,
          body: show.venue,
          link: `/shows/${show.id}`,
          type: 'show_due',
          dedupe_key: `show_due:${show.id}:${today}:${m.user_id}`,
        })
      }
    }
  }

  // Only the rows actually inserted come back, so a re-run pushes nothing.
  let sent = 0
  if (rows.length) {
    const { data: inserted, error: insertErr } = await supabase
      .from('notifications')
      .upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
      .select('recipient_id, title, body, link')
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
    sent = inserted?.length ?? 0
    await Promise.allSettled(
      (inserted ?? []).map(n => sendPushToProfile(n.recipient_id, { title: n.title, body: n.body, link: n.link }))
    )
  }

  const now = Date.now()
  const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString()
  const { count: purgedRead } = await supabase
    .from('notifications')
    .delete({ count: 'exact' })
    .not('read_at', 'is', null)
    .lt('created_at', daysAgo(READ_RETENTION_DAYS))
  const { count: purgedOld } = await supabase
    .from('notifications')
    .delete({ count: 'exact' })
    .lt('created_at', daysAgo(UNREAD_RETENTION_DAYS))

  return NextResponse.json({ ok: true, sent, purged: (purgedRead ?? 0) + (purgedOld ?? 0) })
}
