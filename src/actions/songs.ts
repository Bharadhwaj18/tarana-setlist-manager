'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { SongFormData } from '@/lib/validators'

export async function createSong(data: SongFormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: song, error } = await supabase
    .from('songs')
    .insert({
      ...data,
      bpm: data.bpm ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/songs')
  redirect(`/songs/${song.id}`)
}

export async function updateSong(id: string, data: SongFormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('songs')
    .update({
      ...data,
      bpm: data.bpm ?? null,
      updated_by: user.id,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/songs')
  revalidatePath(`/songs/${id}`)
  redirect(`/songs/${id}`)
}

export async function deleteSong(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('songs').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/songs')
  redirect('/songs')
}
