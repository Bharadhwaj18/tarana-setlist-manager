import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToProfile } from '@/lib/push'
import { todayISO } from '@/lib/shows'
import { addDaysISO } from '@/lib/dates'

// Runs once/day (Vercel Hobby-tier cron limit — see vercel.json). For every
// task with a due date + a configured reminder lead time (remind_days_before,
// set per-task — no fixed cadence), fires exactly on the day that lead time
// lands on today. No logged-in user/cookies are available in a cron
// invocation, so this uses the service-role client (bypasses RLS) rather
// than the cookie-based one, and writes notifications rows directly instead
// of going through the sendNotification server action (which assumes an
// authenticated actor).
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

  let sent = 0
  for (const task of toRemind) {
    const recipientId = task.assigned_to ?? task.created_by
    const dueLabel = task.due_date === today ? 'today' : `on ${task.due_date}`
    const { error } = await supabase.from('notifications').insert({
      recipient_id: recipientId,
      sender_id: null,
      title: `"${task.title}" is due ${dueLabel}`,
      body: null,
      link: '/notes',
      type: 'task_due',
    })
    if (!error) {
      sent++
      await sendPushToProfile(supabase, recipientId, { title: `"${task.title}" is due ${dueLabel}`, link: '/notes' })
    }
  }

  return NextResponse.json({ ok: true, sent })
}
