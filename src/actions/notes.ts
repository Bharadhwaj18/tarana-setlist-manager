'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface NoteFormData {
  title: string
  content: string
}

export async function createNote(data: NoteFormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('notes').insert({
    title: data.title.trim(),
    content: data.content.trim() || null,
    created_by: user.id,
  })
  if (error) return { error: error.message }

  revalidatePath('/notes')
  return {}
}

export async function updateNote(id: string, data: NoteFormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('notes').update({
    title: data.title.trim(),
    content: data.content.trim() || null,
    updated_by: user.id,
  }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/notes')
  return {}
}

export async function deleteNote(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/notes')
  return {}
}
