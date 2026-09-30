import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToProfile } from '@/lib/push'
import { todayISO } from '@/lib/shows'
import { addDaysISO, formatDateDMY } from '@/lib/dates'

// Runs once/day (Vercel Hobby-tier cron limit — see vercel.json). For every
// task with a due date + a configured reminder lead time (remind_days_before,
// set per-task — no fixed cadence), fires exactly on the day that lead time
// lands on today. No logged-in user/cookies are available in a cron
// invocation, so this uses the service-role client (bypasses RLS) rather
// than the cookie-based one, and writes notifications rows directly instead
// of going through the sendNotification server action (which assumes an
// authenticated actor).
export const maxDuration = 60

const CHUNK = 50
function chunked<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today = todayISO()

  const { data: dueTasks } = await supabase
    .from('notes')
    .select('id, title, assigned_to, created_by, due_date, remind_days_before')
    .not('due_date', 'is', null)
    .not('remind_days_before', 'is', null)
    .is('completed_at', null)
    .is('archived_at', null)

  const toRemind = (dueTasks ?? []).filter(t => addDaysISO(t.due_date!, -t.remind_days_before!) === today)

  interface Reminder { recipientId: string; title: string; body: string | null; link: string; type: string }
  const reminders: Reminder[] = toRemind.map(task => {
    const dueLabel = task.due_date === today ? 'today' : `on ${formatDateDMY(task.due_date!)}`
    return { recipientId: task.assigned_to ?? task.created_by, title: `"${task.title}" is due ${dueLabel}`, body: null, link: '/notes', type: 'task_due' }
  })

  // Show reminders — a fixed 3-days-out + day-of pair rather than a
  // per-task lead time, since a show has no single assignee to scope a
  // custom reminder to; every member of the show's workspace gets pinged instead.
  const { data: upcomingShows } = await supabase
    .from('shows')
    .select('id, title, show_date, venue, workspace_id')
    .in('show_date', [today, addDaysISO(today, 3)])

  if (upcomingShows?.length) {
    const workspaceIds = [...new Set(upcomingShows.map(s => s.workspace_id).filter((id): id is string => !!id))]
    const { data: allMembers } = await supabase.from('workspace_members').select('workspace_id, user_id').in('workspace_id', workspaceIds)
    for (const show of upcomingShows) {
      const dueLabel = show.show_date === today ? 'today' : 'in 3 days'
      for (const m of (allMembers ?? []).filter(m => m.workspace_id === show.workspace_id)) {
        reminders.push({ recipientId: m.user_id, title: `"${show.title}" is ${dueLabel}`, body: show.venue, link: `/shows/${show.id}`, type: 'show_due' })
      }
    }
  }

  // Batched: one insert per chunk, pushes fanned out a chunk at a time, so a large
  // number of reminders stays well inside the function time limit.
  let sent = 0
  for (const chunk of chunked(reminders, CHUNK)) {
    const { error } = await supabase.from('notifications').insert(
      chunk.map(r => ({ recipient_id: r.recipientId, sender_id: null, title: r.title, body: r.body, link: r.link, type: r.type }))
    )
    if (error) continue
    sent += chunk.length
    await Promise.allSettled(chunk.map(r => sendPushToProfile(supabase, r.recipientId, { title: r.title, body: r.body, link: r.link })))
  }

  return NextResponse.json({ ok: true, sent })
}
