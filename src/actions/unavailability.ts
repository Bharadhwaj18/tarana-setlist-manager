'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendNotification, sendNotificationToAll } from '@/actions/notifications'
import type { UnavailabilityFormData } from '@/lib/validators'

export async function addUnavailability(data: UnavailabilityFormData): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: row, error } = await supabase.from('unavailability').insert({
    member_id: data.member_id,
    start_date: data.start_date,
    end_date: data.end_date,
    reason: data.reason?.trim() || null,
  }).select('id').single()
  if (error) return { error: error.message }

  const { data: member } = await supabase.from('profiles').select('display_name').eq('id', data.member_id).maybeSingle()
  const memberName = member?.display_name ?? 'A member'
  const dateRange = data.start_date === data.end_date ? data.start_date : `${data.start_date} to ${data.end_date}`

  await sendNotificationToAll({
    title: `${memberName} is unavailable ${dateRange}`,
    body: data.reason ?? undefined,
    link: '/calendar',
    type: 'unavailability_added',
  })

  // Flag it immediately to whoever booked any show already sitting in that
  // window, rather than leaving them to notice the clash on the Calendar
  // themselves.
  const { data: conflicts } = await supabase
    .from('shows')
    .select('id, title, show_date, created_by')
    .gte('show_date', data.start_date)
    .lte('show_date', data.end_date)

  for (const show of conflicts ?? []) {
    if (show.created_by === user.id) continue
    await sendNotification({
      recipientId: show.created_by,
      title: `${memberName} is unavailable on ${show.show_date}`,
      body: `Conflicts with "${show.title}"`,
      link: `/shows/${show.id}`,
      type: 'unavailability_conflict',
    })
  }

  revalidatePath('/calendar')
  return { id: row.id }
}

export async function updateUnavailability(id: string, data: UnavailabilityFormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('unavailability').update({
    member_id: data.member_id,
    start_date: data.start_date,
    end_date: data.end_date,
    reason: data.reason?.trim() || null,
  }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/calendar')
  return {}
}

export async function deleteUnavailability(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('unavailability').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/calendar')
  return {}
}
