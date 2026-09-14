'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { EventManagementFormData } from '@/lib/validators'

export async function createEventManagement(data: EventManagementFormData): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: company, error } = await supabase
    .from('event_management')
    .insert({ ...data, created_by: user.id })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/event-management')
  redirect(`/event-management/${company.id}`)
}

export async function updateEventManagement(id: string, data: EventManagementFormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('event_management').update({ ...data, updated_by: user.id }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/event-management')
  revalidatePath(`/event-management/${id}`)
  redirect(`/event-management/${id}`)
}

export async function deleteEventManagement(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('event_management').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/event-management')
  revalidatePath('/shows')
  redirect('/event-management')
}
