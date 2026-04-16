'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { SetlistFormData } from '@/lib/validators'
import type { ParsedSong } from '@/lib/setlist-parser'

export async function createSetlist(data: SetlistFormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: setlist, error } = await supabase
    .from('setlists')
    .insert({ ...data, created_by: user.id })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/setlists')
  redirect(`/setlists/${setlist.id}`)
}

export async function updateSetlist(id: string, data: SetlistFormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('setlists').update({ ...data, updated_by: user.id }).eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/setlists')
  revalidatePath(`/setlists/${id}`)
  redirect(`/setlists/${id}`)
}

export async function deleteSetlist(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('setlists').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/setlists')
  redirect('/setlists')
}

export async function addSongToSetlist(setlistId: string, songId: string) {
  const supabase = await createClient()

  // Get max position
  const { data: existing } = await supabase
    .from('setlist_songs')
    .select('position')
    .eq('setlist_id', setlistId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing?.[0] ? existing[0].position + 1 : 0

  const { error } = await supabase
    .from('setlist_songs')
    .insert({ setlist_id: setlistId, song_id: songId, position: nextPosition })

  if (error && error.code !== '23505') throw new Error(error.message) // ignore duplicate

  revalidatePath(`/setlists/${setlistId}`)
}

export async function removeSongFromSetlist(setlistId: string, songId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('setlist_songs')
    .delete()
    .eq('setlist_id', setlistId)
    .eq('song_id', songId)

  if (error) throw new Error(error.message)
  revalidatePath(`/setlists/${setlistId}`)
}

export async function bulkImportSongs(
  setlistId: string,
  parsedSongs: ParsedSong[]
): Promise<{ imported: number; created: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Fetch all existing songs to match by title (case-insensitive)
  const { data: existingSongs } = await supabase.from('songs').select('id, title')
  const songMap = new Map(
    (existingSongs ?? []).map(s => [s.title.toLowerCase().trim(), s.id])
  )

  // Fetch existing setlist entries to know current max position and skip duplicates
  const { data: currentEntries } = await supabase
    .from('setlist_songs')
    .select('song_id, position')
    .eq('setlist_id', setlistId)
    .order('position', { ascending: false })

  const alreadyInSetlist = new Set((currentEntries ?? []).map(e => e.song_id))
  let nextPosition = currentEntries?.[0] ? currentEntries[0].position + 1 : 0
  let created = 0
  let imported = 0

  for (const parsed of parsedSongs) {
    const key = parsed.title.toLowerCase().trim()
    let songId = songMap.get(key)

    // Create the song if it doesn't exist
    if (!songId) {
      const { data: newSong, error } = await supabase
        .from('songs')
        .insert({
          title: parsed.title,
          song_key: parsed.song_key ?? null,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (error || !newSong) continue
      songId = newSong.id
      songMap.set(key, songId)
      created++
    }

    // Skip if already in this setlist
    if (alreadyInSetlist.has(songId)) continue

    const { error } = await supabase.from('setlist_songs').insert({
      setlist_id: setlistId,
      song_id: songId,
      position: nextPosition,
      section: parsed.section,
    })

    if (!error) {
      alreadyInSetlist.add(songId)
      nextPosition++
      imported++
    }
  }

  revalidatePath(`/setlists/${setlistId}`)
  revalidatePath('/songs')
  return { imported, created }
}

export async function reorderSetlistSongs(setlistId: string, orderedSongIds: string[]) {
  const supabase = await createClient()

  const updates = orderedSongIds.map((songId, index) => ({
    setlist_id: setlistId,
    song_id: songId,
    position: index,
  }))

  const { error } = await supabase
    .from('setlist_songs')
    .upsert(updates, { onConflict: 'setlist_id,song_id' })

  if (error) throw new Error(error.message)
  revalidatePath(`/setlists/${setlistId}`)
}
