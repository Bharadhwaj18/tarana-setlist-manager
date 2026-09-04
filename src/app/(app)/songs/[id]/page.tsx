import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ChevronLeft, Pencil, Clock, Hash, Music } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCachedSong, getCachedAllProfiles, getCachedSetlistSongs } from '@/lib/data'
import { ChordViewer } from '@/components/songs/ChordViewer'
import { ActiveSetlistSync } from '@/components/setlists/ActiveSetlistSync'
import { Button } from '@/components/ui/Button'
import { DeleteSongButton } from '@/components/songs/DeleteSongButton'
import { SongPdfExport } from '@/components/pdf/SongPdfExport'
import { ACTIVE_SETLIST_COOKIE } from '@/lib/setlist-context'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}

export default async function SongPage({ params, searchParams }: Props) {
  const { id } = await params
  const { from } = await searchParams

  // `from` in the URL is the explicit, authoritative source. When it's
  // missing — browser back/forward, a bookmarked/shared link, or any link
  // that simply forgot to carry it — fall back to the last setlist we know
  // was active, so context isn't lost just because one hop dropped it.
  const explicitSetlistId = from?.match(/^\/setlists\/([^/]+)$/)?.[1] ?? null
  const cookieSetlistId = explicitSetlistId
    ? null
    : (await cookies()).get(ACTIVE_SETLIST_COOKIE)?.value ?? null
  const setlistId = explicitSetlistId ?? cookieSetlistId
  const canonicalFrom = setlistId ? `/setlists/${setlistId}` : null

  const supabase = await createClient()
  const [song, profiles, { data: { user } }, setlistSongs] = await Promise.all([
    getCachedSong(id),
    getCachedAllProfiles(),
    supabase.auth.getUser(),
    setlistId ? getCachedSetlistSongs(setlistId) : Promise.resolve([]),
  ])

  if (!song) notFound()

  const nameOf = (uid: string) =>
    uid === user?.id ? 'You' : (profiles.find(p => p.id === uid)?.display_name ?? 'Band member')

  return (
    <div className="max-w-3xl">
      <ActiveSetlistSync setlistId={setlistId} />

      <Link href={canonicalFrom ?? '/songs'} className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> {canonicalFrom ? 'Back to setlist' : 'Songs'}
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{song.title}</h1>
          {song.artist && <p className="mt-0.5 text-gray-500">{song.artist}</p>}
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-500">
            {song.song_key && (
              <span className="flex items-center gap-1.5">
                <Music className="h-4 w-4" /> Key of {song.song_key}
              </span>
            )}
            {song.bpm && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> {song.bpm} BPM
              </span>
            )}
            {song.time_signature && (
              <span className="flex items-center gap-1.5">
                <Hash className="h-4 w-4" /> {song.time_signature}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SongPdfExport song={song} />
          <Button variant="secondary" size="sm" asChild>
            <Link href={canonicalFrom ? `/songs/${id}/edit?from=${encodeURIComponent(canonicalFrom)}` : `/songs/${id}/edit`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </Button>
          <DeleteSongButton id={id} />
        </div>
      </div>

      {/* Created / modified by */}
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-gray-400">
        <span>Added by <span className="font-medium text-gray-600">{nameOf(song.created_by)}</span></span>
        {song.updated_by && (
          <span>Last edited by <span className="font-medium text-gray-600">{nameOf(song.updated_by)}</span></span>
        )}
      </div>

      {/* Notes */}
      {song.notes && (
        <div className="mb-6 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-200">
          <strong className="block mb-1">Notes</strong>
          <span className="whitespace-pre-wrap">{song.notes}</span>
        </div>
      )}

      {/* Chord chart — keyed by song id so navigating between songs (e.g. via
          setlist prev/next, which reuse this same route) remounts with fresh
          state instead of needing an effect to manually reset it. */}
      <ChordViewer
        key={id}
        chordChart={song.chord_chart ?? ''}
        songKey={song.song_key}
        songId={id}
        songTitle={song.title}
        bpm={song.bpm}
        setlistId={setlistId ?? undefined}
        setlistSongs={setlistSongs.map(ss => ({
          id: ss.song_id,
          title: ss.song.title,
          chord_chart: ss.song.chord_chart ?? '',
          song_key: ss.song.song_key ?? null,
          bpm: ss.song.bpm ?? null,
        }))}
      />
    </div>
  )
}
