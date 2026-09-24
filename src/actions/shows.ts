'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sendNotificationToAll } from '@/actions/notifications'
import { formatDateDMY } from '@/lib/dates'
import type { ShowFormData } from '@/lib/validators'

async function actorName(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle()
  return data?.display_name ?? 'Someone'
}

export async function createShow(data: ShowFormData): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: show, error } = await supabase
    .from('shows')
    .insert({ ...data, created_by: user.id })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await sendNotificationToAll({
    title: `${await actorName(supabase, user.id)} booked a new show`,
    body: data.show_date ? `"${data.title}" on ${formatDateDMY(data.show_date)}` : `"${data.title}"`,
    link: `/shows/${show.id}`,
    type: 'show_created',
  })

  revalidatePath('/shows')
  revalidatePath('/finance')
  revalidatePath('/finance/split')
  revalidatePath('/calendar')
  redirect(`/shows/${show.id}`)
}

export async function updateShow(id: string, data: ShowFormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: existing } = await supabase.from('shows').select('title, show_date, venue, booking_status').eq('id', id).maybeSingle()

  const { error } = await supabase.from('shows').update({ ...data, updated_by: user.id }).eq('id', id)
  if (error) return { error: error.message }

  if (existing) {
    const changes: string[] = []
    if (data.booking_status !== undefined && data.booking_status !== existing.booking_status) changes.push(`Status → ${data.booking_status ?? '—'}`)
    if (data.show_date !== undefined && data.show_date !== existing.show_date) changes.push(`Date → ${data.show_date ? formatDateDMY(data.show_date) : '—'}`)
    if (data.venue !== undefined && data.venue !== existing.venue) changes.push(`Venue → ${data.venue ?? '—'}`)

    if (changes.length) {
      await sendNotificationToAll({
        title: `${await actorName(supabase, user.id)} updated "${existing.title}"`,
        body: changes.join(' · '),
        link: `/shows/${id}`,
        type: 'show_updated',
      })
    }
  }

  revalidatePath('/shows')
  revalidatePath(`/shows/${id}`)
  revalidatePath('/finance')
  revalidatePath('/finance/split')
  revalidatePath('/calendar')
  redirect(`/shows/${id}`)
}

export async function deleteShow(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: show } = await supabase.from('shows').select('title, show_date').eq('id', id).maybeSingle()

  const { error } = await supabase.from('shows').delete().eq('id', id)
  if (error) return { error: error.message }

  if (show && user) {
    await sendNotificationToAll({
      title: `${await actorName(supabase, user.id)} removed "${show.title}"`,
      body: show.show_date ? `Was on ${formatDateDMY(show.show_date)}` : undefined,
      link: '/shows',
      type: 'show_cancelled',
    })
  }

  revalidatePath('/shows')
  revalidatePath('/finance')
  revalidatePath('/finance/split')
  revalidatePath('/calendar')
  redirect('/shows')
}
