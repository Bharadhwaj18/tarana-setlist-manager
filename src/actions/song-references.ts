'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspaceId } from '@/lib/workspace'
import { availableSearchSources, lookupReference, searchSource, type ReferenceDetails, type SearchResult, type SearchSource } from '@/lib/reference-lookup'
import { MAX_LABEL_LENGTH, cleanMoments, type Moment } from '@/lib/song-references'
import type { Json } from '@/types/database'

/** Moments as stored JSON. */
const momentsJson = (moments: Moment[]): Json => cleanMoments(moments).map(m => ({ label: m.label, at: m.at }))

const NOT_A_LINK = 'Paste a song link from Spotify, YouTube, Apple Music or SoundCloud.'

/** Errors from the database, in words people can act on. */
function friendly(message: string) {
  if (/song_references|cover_url/.test(message) && /does not exist|schema cache/.test(message)) {
    return 'Song references aren’t switched on yet. Run the song references SQL in Supabase first.'
  }
  if (/row-level security/.test(message)) return 'You can only view songs in this workspace, not change them.'
  return message
}

/** What a pasted link points at, to show before it's saved. */
export async function previewReference(link: string): Promise<{ details?: ReferenceDetails; error?: string }> {
  const details = await lookupReference(link)
  return details ? { details } : { error: NOT_A_LINK }
}

const SEARCH_NAMES: Record<SearchSource, string> = { youtube: 'YouTube', spotify: 'Spotify' }

/** Search YouTube or Spotify for the add-reference sheet. Only offered for services whose keys are set. */
export async function searchReferences(source: SearchSource, query: string): Promise<{ results?: SearchResult[]; error?: string }> {
  if (!availableSearchSources().includes(source)) return { error: `${SEARCH_NAMES[source]} search isn’t switched on. Paste a link instead.` }
  const q = query.trim().slice(0, 100)
  if (q.length < 2) return { results: [] }
  const results = await searchSource(source, q)
  if (results) return { results }
  return {
    error: source === 'youtube'
      ? 'YouTube search isn’t answering right now. It may have used up today’s searches, so paste a link instead.'
      : 'Spotify search isn’t answering right now, so paste a link instead.',
  }
}

interface AddInput {
  songId: string
  link: string
  label: string
  moments: Moment[]
}

export async function addSongReference({ songId, link, label, moments }: AddInput): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const cleanLabel = label.trim().slice(0, MAX_LABEL_LENGTH)
  if (!cleanLabel) return { error: 'Give the reference a label, like Original.' }
  const details = await lookupReference(link)
  if (!details) return { error: NOT_A_LINK }

  const { data: song } = await supabase.from('songs').select('id, workspace_id, artist, cover_url').eq('id', songId).maybeSingle()
  if (!song) return { error: 'That song is no longer there.' }

  const { data: last } = await supabase.from('song_references').select('position').eq('song_id', song.id)
    .order('position', { ascending: false }).limit(1).maybeSingle()

  const { data: row, error } = await supabase.from('song_references').insert({
    workspace_id: song.workspace_id ?? await requireWorkspaceId(),
    song_id: song.id,
    source: details.source,
    url: details.url,
    external_id: details.externalId,
    label: cleanLabel,
    title: details.title,
    artist: details.artist,
    thumbnail_url: details.thumbnailUrl,
    duration_ms: details.durationMs,
    moments: momentsJson(moments),
    position: (last?.position ?? 0) + 1,
  }).select('id').single()
  if (error) return { error: friendly(error.message) }

  // Fill the song's cover, and its artist from Spotify, when they're still empty.
  // (A YouTube or SoundCloud "author" is whoever uploaded it, not the artist.)
  const fill: { cover_url?: string; artist?: string; updated_by?: string } = {}
  if (!song.cover_url && details.thumbnailUrl) fill.cover_url = details.thumbnailUrl
  if (!song.artist && details.artist && details.source === 'spotify') fill.artist = details.artist
  if (Object.keys(fill).length) await supabase.from('songs').update({ ...fill, updated_by: user.id }).eq('id', song.id)

  revalidatePath(`/songs/${song.id}`)
  revalidatePath('/songs')
  return { id: row.id }
}

export async function updateSongReference(id: string, patch: { label?: string; moments?: Moment[] }): Promise<{ error?: string }> {
  const supabase = await createClient()
  const update: { label?: string; moments?: Json } = {}
  if (patch.label !== undefined) {
    const label = patch.label.trim().slice(0, MAX_LABEL_LENGTH)
    if (!label) return { error: 'Give the reference a label, like Original.' }
    update.label = label
  }
  if (patch.moments !== undefined) update.moments = momentsJson(patch.moments)
  const { data, error } = await supabase.from('song_references').update(update).eq('id', id).select('song_id').single()
  if (error) return { error: friendly(error.message) }
  revalidatePath(`/songs/${data.song_id}`)
  return {}
}

export async function deleteSongReference(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('song_references').delete().eq('id', id).select('song_id').single()
  if (error) return { error: friendly(error.message) }
  revalidatePath(`/songs/${data.song_id}`)
  revalidatePath('/songs')
  return {}
}
