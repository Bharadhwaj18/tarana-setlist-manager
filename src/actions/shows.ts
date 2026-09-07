'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ShowFormData } from '@/lib/validators'

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

  revalidatePath('/shows')
  revalidatePath('/finance')
  revalidatePath('/finance/split')
  redirect(`/shows/${show.id}`)
}

export async function updateShow(id: string, data: ShowFormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('shows').update({ ...data, updated_by: user.id }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/shows')
  revalidatePath(`/shows/${id}`)
  revalidatePath('/finance')
  revalidatePath('/finance/split')
  redirect(`/shows/${id}`)
}

export async function deleteShow(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('shows').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/shows')
  revalidatePath('/finance')
  revalidatePath('/finance/split')
  redirect('/shows')
}
