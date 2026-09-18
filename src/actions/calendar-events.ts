'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CalendarEventFormData } from '@/lib/validators'

export async function addCalendarEvent(data: CalendarEventFormData): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: row, error } = await supabase.from('calendar_events').insert({
    title: data.title.trim(),
    start_date: data.start_date,
    end_date: data.end_date,
    notes: data.notes?.trim() || null,
    created_by: user.id,
  }).select('id').single()
  if (error) return { error: error.message }

  revalidatePath('/calendar')
  return { id: row.id }
}

export async function updateCalendarEvent(id: string, data: CalendarEventFormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('calendar_events').update({
    title: data.title.trim(),
    start_date: data.start_date,
    end_date: data.end_date,
    notes: data.notes?.trim() || null,
  }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/calendar')
  return {}
}

export async function deleteCalendarEvent(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('calendar_events').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/calendar')
  return {}
}
