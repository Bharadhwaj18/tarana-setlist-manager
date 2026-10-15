import { notFound } from 'next/navigation'
import { sectionGuard } from '@/lib/section-guard'
import { LinkedNotes } from '@/components/notes/LinkedNotes'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { getCachedSong, getCachedSetlist, getCachedAllProfiles, getCachedSetlistSongs, getCachedUser, getCachedRecordings, getCachedSongs } from '@/lib/data'
import { ChordViewer } from '@/components/songs/ChordViewer'
import { ActiveSetlistSync } from '@/components/setlists/ActiveSetlistSync'
import { RecordingsList } from '@/components/recordings/RecordingsList'
import { Button } from '@/components/ui/Button'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { StatusPill } from '@/components/ui/StatusPill'
import { SongPdfExport } from '@/components/pdf/SongPdfExport'
import { ACTIVE_SETLIST_COOKIE } from '@/lib/setlist-context'
import type { RecordingWithSong } from '@/types'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; stage?: string }>
}

export default async function SongPage({ params, searchParams }: Props) {
  const denied = await sectionGuard('songs')
  if (denied) return denied
  const { id } = await params
  const { from, stage } = await searchParams

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

  const [song, setlist, profiles, { data: { user } }, setlistSongs, recordings, allSongs] = await Promise.all([
    getCachedSong(id),
    setlistId ? getCachedSetlist(setlistId) : Promise.resolve(null),
    getCachedAllProfiles(),
    getCachedUser(),
    setlistId ? getCachedSetlistSongs(setlistId) : Promise.resolve([]),
    getCachedRecordings(),
    getCachedSongs(),
  ])

  if (!song) notFound()

  const taggedRecordings = (recordings as RecordingWithSong[]).filter(r => r.song_id === id)

  const nameOf = (uid: string) =>
    uid === user?.id ? 'You' : (profiles.find(p => p.id === uid)?.display_name ?? 'Band member')

  // Where this song sits in the setlist we arrived from, for the previous / next bar.
  const position = setlistSongs.findIndex(ss => ss.song_id === id)
  const prevSong = position > 0 ? setlistSongs[position - 1] : null
  const nextSong = position >= 0 && position < setlistSongs.length - 1 ? setlistSongs[position + 1] : null
  const songHref = (songId: string) => `/songs/${songId}?from=${encodeURIComponent(canonicalFrom ?? '')}`

  const editHref = canonicalFrom ? `/songs/${id}/edit?from=${encodeURIComponent(canonicalFrom)}` : `/songs/${id}/edit`

  return (
    <div>
      <ActiveSetlistSync setlistId={setlistId} />

      {canonicalFrom ? (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800">
          <Link href={canonicalFrom} className="inline-flex min-w-0 items-center gap-1 hover:underline">
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {setlist?.title ?? 'Setlist'}{position >= 0 && ` · song ${position + 1} of ${setlistSongs.length}`}
            </span>
          </Link>
          <span className="flex shrink-0 items-center gap-3 font-bold">
            {prevSong ? <Link href={songHref(prevSong.song_id)} className="inline-flex items-center hover:underline"><ChevronLeft className="h-4 w-4" />Previous</Link> : null}
            {nextSong ? <Link href={songHref(nextSong.song_id)} className="inline-flex items-center hover:underline">Next<ChevronRight className="h-4 w-4" /></Link> : null}
          </span>
        </div>
      ) : (
        <Link href="/songs" className="mb-5 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft className="h-4 w-4" /> Songs
        </Link>
      )}

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">{song.title}</h1>
          {song.artist && <p className="mt-0.5 text-gray-500">{song.artist}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {song.song_key && (
              <span className="inline-flex items-center rounded-full bg-hero px-3 py-1 text-xs font-bold text-hero-fg">Key of {song.song_key}</span>
            )}
            {song.bpm && <StatusPill className="px-3 py-1 text-xs">{song.bpm} BPM</StatusPill>}
            {song.time_signature && <StatusPill className="px-3 py-1 text-xs">{song.time_signature}</StatusPill>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SongPdfExport song={song} />
          <Button variant="secondary" size="sm" asChild>
            <Link href={editHref}><Pencil className="h-4 w-4" /> Edit</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
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
          setlistTitle={setlist?.title}
          notes={song.notes}
          autoStage={stage === '1'}
          setlistSongs={setlistSongs.map(ss => ({
            id: ss.song_id,
            title: ss.song.title,
            chord_chart: ss.song.chord_chart ?? '',
            song_key: ss.song.song_key ?? null,
            bpm: ss.song.bpm ?? null,
            notes: ss.song.notes ?? null,
            section: ss.section ?? null,
          }))}
        />

        <aside className="space-y-4">
          {song.notes && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <SectionLabel className="mb-1.5 text-amber-700">Band notes</SectionLabel>
              <p className="whitespace-pre-wrap">{song.notes}</p>
            </div>
          )}

          <div className="mb-6"><LinkedNotes songId={id} /></div>

      {/* Recordings tagged to this song — reuses the same list component as
              /recordings, filtered down to this song's own tag. */}
          {taggedRecordings.length > 0 && (
            <div>
              <SectionLabel className="mb-2">Recordings · {taggedRecordings.length}</SectionLabel>
              <RecordingsList
                recordings={taggedRecordings}
                songs={allSongs.map(s => ({ id: s.id, title: s.title }))}
              />
            </div>
          )}

          <p className="px-1 text-xs leading-relaxed text-gray-400">
            Added by <span className="font-medium text-gray-600">{nameOf(song.created_by)}</span>
            {song.updated_by && <> · Last edited by <span className="font-medium text-gray-600">{nameOf(song.updated_by)}</span></>}
          </p>
        </aside>
      </div>
    </div>
  )
}
