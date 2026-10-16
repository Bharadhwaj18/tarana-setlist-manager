import { notFound } from 'next/navigation'
import { sectionGuard } from '@/lib/section-guard'
import Link from 'next/link'
import { ChevronLeft, Pencil, Calendar, MapPin, Link2, Play } from 'lucide-react'
import { getCachedSetlist, getCachedSetlistSongs, getCachedSongs, getCachedAllProfiles, getCachedUser, getCachedShow } from '@/lib/data'
import { SetlistSongList } from '@/components/setlists/SetlistSongList'
import { AddSongToSetlistModal } from '@/components/setlists/AddSongToSetlistModal'
import { BulkImportModal } from '@/components/setlists/BulkImportModal'
import { DeleteSetlistButton } from '@/components/setlists/DeleteSetlistButton'
import { ActiveSetlistSync } from '@/components/setlists/ActiveSetlistSync'
import { SetlistPdfExport } from '@/components/pdf/SetlistPdfExport'
import { SaveOfflineButton } from '@/components/setlists/SaveOfflineButton'
import { RehearseCard } from '@/components/references/Rehearse'
import { getCachedReferenceRows } from '@/lib/data'
import { coverLinksBySong, firstReferenceBySong } from '@/lib/song-references'
import { Button } from '@/components/ui/Button'
import { SectionLabel } from '@/components/ui/SectionLabel'
import type { SetlistSongWithSong } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

const AVG_SONG_MINUTES = 4.5

export default async function SetlistPage({ params }: Props) {
  const denied = await sectionGuard('setlists')
  if (denied) return denied
  const { id } = await params

  const [setlist, setlistSongs, allSongs, profiles, { data: { user } }] = await Promise.all([
    getCachedSetlist(id),
    getCachedSetlistSongs(id),
    getCachedSongs(),
    getCachedAllProfiles(),
    getCachedUser(),
  ])

  if (!setlist) notFound()

  const linkedShow = setlist.show_id ? await getCachedShow(setlist.show_id) : null

  const nameOf = (uid: string) =>
    uid === user?.id ? 'You' : (profiles.find(p => p.id === uid)?.display_name ?? 'Band member')

  const date = setlist.show_date
    ? new Date(setlist.show_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const currentSongIds = setlistSongs.map(ss => ss.song_id)
  const currentSongTitles = setlistSongs.map(ss => ss.song.title)
  const availableSections = [...new Set(
    setlistSongs.map(ss => ss.section).filter((s): s is string => !!s)
  )]

  // Rehearse plays each song's first playable reference, in set order.
  const referenceRows = await getCachedReferenceRows()
  const firstRef = firstReferenceBySong(referenceRows)
  const coverLinks = coverLinksBySong(referenceRows, setlistSongs.map(ss => ({ id: ss.song_id, cover_url: ss.song.cover_url ?? null })))
  const rehearsal = setlistSongs.map(ss => ({
    songId: ss.song_id, title: ss.song.title, artist: ss.song.artist ?? null, songKey: ss.song.song_key ?? null,
    coverUrl: ss.song.cover_url ?? null, coverLink: coverLinks[ss.song_id] ?? null, reference: firstRef[ss.song_id] ?? null,
  }))
  const songCount = setlistSongs.length
  const estimatedMinutes = Math.round(songCount * AVG_SONG_MINUTES)
  const songsWithoutChart = setlistSongs.filter(ss => !ss.song.chord_chart?.trim()).map(ss => ss.song.title)
  const firstSong = setlistSongs[0]?.song

  return (
    <div>
      <ActiveSetlistSync setlistId={id} />

      <Link href="/setlists" className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Setlists
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-bold text-gray-900">{setlist.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-500">
            {date && <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{date}</span>}
            {setlist.venue && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{setlist.venue}</span>}
            {linkedShow && (
              <Link href={`/shows/${linkedShow.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 hover:opacity-80">
                <Link2 className="h-3.5 w-3.5" /> {linkedShow.title} →
              </Link>
            )}
          </div>
          {setlist.notes && <p className="mt-2 text-sm italic text-gray-500">{setlist.notes}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {firstSong && (
            <Button asChild>
              <Link href={`/songs/${firstSong.id}?from=/setlists/${id}&stage=1`}><Play className="h-4 w-4" /> Stage mode</Link>
            </Button>
          )}
          <Button variant="secondary" asChild>
            <Link href={`/setlists/${id}/edit`}><Pencil className="h-4 w-4" /> Edit details</Link>
          </Button>
          <DeleteSetlistButton id={id} />
        </div>
      </div>

      <RehearseCard songs={rehearsal} />

      <div className="grid gap-5 lg:h-[calc(100vh-14rem)] lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        {/* Songs */}
        <div className="no-scrollbar min-w-0 lg:overflow-y-auto lg:pb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-gray-900">
              {songCount} {songCount === 1 ? 'song' : 'songs'}
              <span className="ml-1.5 font-medium text-gray-500">· about {estimatedMinutes} min</span>
            </p>
            <div className="flex gap-2">
              <BulkImportModal
                setlistId={id}
                existingSongs={allSongs}
                currentSongTitles={currentSongTitles}
              />
              <AddSongToSetlistModal
                setlistId={id}
                allSongs={allSongs}
                currentSongIds={currentSongIds}
                availableSections={availableSections}
              />
            </div>
          </div>

          {/* Drag-and-drop song list */}
          <SetlistSongList
            setlistId={id}
            initialItems={setlistSongs as SetlistSongWithSong[]}
          />
        </div>

        {/* Side column */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-2xl bg-hero p-5 text-hero-fg">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-sidebar-accent">Show night</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <SaveOfflineButton
                setlistId={id}
                setlistTitle={setlist.title}
                showDate={setlist.show_date}
                venue={setlist.venue}
                items={setlistSongs.map(ss => ({ song: ss.song, section: (ss as SetlistSongWithSong).section }))}
              />
              <SetlistPdfExport setlist={setlist} songs={setlistSongs.map(ss => ss.song)} />
            </div>
          </div>

          {songsWithoutChart.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-700">Heads up</p>
              <p className="mt-1.5 text-sm leading-relaxed">
                {songsWithoutChart.length === 1
                  ? `1 song has no chord chart yet: ${songsWithoutChart[0]}.`
                  : `${songsWithoutChart.length} songs have no chord chart yet: ${songsWithoutChart.slice(0, 3).join(', ')}${songsWithoutChart.length > 3 ? '…' : ''}.`}
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
            <SectionLabel>Details</SectionLabel>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Songs</dt><dd className="font-bold text-gray-900">{songCount}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Estimated time</dt><dd className="font-bold text-gray-900">{estimatedMinutes} min</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Created by</dt><dd className="font-bold text-gray-900">{nameOf(setlist.created_by)}</dd></div>
              {setlist.updated_by && (
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Last edited by</dt><dd className="font-bold text-gray-900">{nameOf(setlist.updated_by)}</dd></div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
