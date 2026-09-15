'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { UnavailabilityFormData } from '@/lib/validators'

export async function addUnavailability(data: UnavailabilityFormData): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: row, error } = await supabase.from('unavailability').insert({
    member_id: data.member_id,
    start_date: data.start_date,
    end_date: data.end_date,
    reason: data.reason?.trim() || null,
  }).select('id').single()
  if (error) return { error: error.message }

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
