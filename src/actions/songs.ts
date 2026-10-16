'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspaceId } from '@/lib/workspace'
import type { SongFormData } from '@/lib/validators'
import { addSongReference } from '@/actions/song-references'

/** Just the song's own columns from the form (the link and cover are handled separately). */
function songColumns(data: SongFormData) {
  const { title, artist, song_key, bpm, time_signature, chord_chart, notes } = data
  return { title, artist, song_key, bpm: bpm ?? null, time_signature, chord_chart, notes }
}

export async function createSong(data: SongFormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: song, error } = await supabase
    .from('songs')
    .insert({
      ...songColumns(data),
      ...(data.cover_url ? { cover_url: data.cover_url } : {}),
      created_by: user.id,
      workspace_id: await requireWorkspaceId(),
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // A link pasted on New song becomes the Original reference. The song is saved either way.
  if (data.reference_url) await addSongReference({ songId: song.id, link: data.reference_url, label: 'Original', moments: [] })

  revalidatePath('/songs')
  redirect(`/songs/${song.id}`)
}

export async function updateSong(id: string, data: SongFormData, redirectTo?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('songs')
    .update({
      ...songColumns(data),
      updated_by: user.id,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/songs')
  revalidatePath(`/songs/${id}`)
  redirect(redirectTo ?? `/songs/${id}`)
}

export async function saveTranspose(
  songId: string,
  chordChart: string,
  newKey: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('songs')
    .update({
      chord_chart: chordChart,
      ...(newKey !== null && { song_key: newKey }),
      updated_by: user.id,
    })
    .eq('id', songId)

  if (error) return { error: error.message }

  revalidatePath('/songs')
  revalidatePath(`/songs/${songId}`)
  return {}
}

export async function deleteSong(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('songs').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/songs')
  return {}
}
