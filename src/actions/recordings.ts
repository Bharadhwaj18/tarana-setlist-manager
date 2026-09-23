'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'recordings'

interface CreateRecordingInput {
  title: string
  filePath: string
  durationSeconds: number
  mimeType: string
  songId?: string | null
}

// A tagged recording also shows up on that song's own page (RecordingsList,
// reused there) — every write here needs to revalidate both /recordings
// and any song page(s) it could affect, not just /recordings, or an edit
// made from the song page silently wouldn't show up there until a hard
// reload.
function revalidateRecordingPaths(...songIds: (string | null | undefined)[]) {
  revalidatePath('/recordings')
  for (const songId of songIds) {
    if (songId) revalidatePath(`/songs/${songId}`)
  }
}

// The audio blob itself is already sitting in Storage by the time this
// runs — uploaded straight from the browser (see lib/audio-recorder.ts),
// not routed through this action, since a several-MB voice memo would
// exceed a Server Action's default body-size limit. This just records the
// row once that upload has succeeded.
export async function createRecording(input: CreateRecordingInput): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase.from('recordings').insert({
    title: input.title.trim() || 'Untitled recording',
    file_path: input.filePath,
    duration_seconds: input.durationSeconds,
    mime_type: input.mimeType,
    song_id: input.songId ?? null,
    created_by: user.id,
  }).select('id').single()
  if (error) return { error: error.message }

  revalidateRecordingPaths(input.songId)
  return { id: data.id }
}

export async function renameRecording(id: string, title: string): Promise<{ error?: string }> {
  const trimmed = title.trim()
  if (!trimmed) return { error: 'Title is required' }

  const supabase = await createClient()
  const { data, error } = await supabase.from('recordings').update({ title: trimmed }).eq('id', id).select('song_id').maybeSingle()
  if (error) return { error: error.message }

  revalidateRecordingPaths(data?.song_id)
  return {}
}

export async function tagRecordingToSong(id: string, songId: string | null): Promise<{ error?: string }> {
  const supabase = await createClient()

  // The previous tag needs revalidating too — moving a recording off a
  // song should make it disappear from that song's page, not just make it
  // appear on the new one.
  const { data: before } = await supabase.from('recordings').select('song_id').eq('id', id).maybeSingle()

  const { error } = await supabase.from('recordings').update({ song_id: songId }).eq('id', id)
  if (error) return { error: error.message }

  revalidateRecordingPaths(before?.song_id, songId)
  return {}
}

export async function deleteRecording(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: recording, error: fetchError } = await supabase
    .from('recordings')
    .select('file_path, song_id')
    .eq('id', id)
    .maybeSingle()
  if (fetchError) return { error: fetchError.message }

  const { error } = await supabase.from('recordings').delete().eq('id', id)
  if (error) return { error: error.message }

  // Best-effort — the row is already gone either way, and an orphaned
  // Storage object is a cheap, invisible cost, not something worth failing
  // this action over.
  if (recording?.file_path) {
    await supabase.storage.from(BUCKET).remove([recording.file_path])
  }

  revalidateRecordingPaths(recording?.song_id)
  return {}
}
