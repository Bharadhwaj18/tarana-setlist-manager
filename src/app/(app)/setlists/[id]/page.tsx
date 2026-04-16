import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Pencil, Calendar, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SetlistSongList } from '@/components/setlists/SetlistSongList'
import { AddSongToSetlistModal } from '@/components/setlists/AddSongToSetlistModal'
import { BulkImportModal } from '@/components/setlists/BulkImportModal'
import { DeleteSetlistButton } from '@/components/setlists/DeleteSetlistButton'
import { SetlistPdfExport } from '@/components/pdf/SetlistPdfExport'
import { SaveOfflineButton } from '@/components/setlists/SaveOfflineButton'
import { Button } from '@/components/ui/Button'
import type { SetlistSongWithSong } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SetlistPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: setlist }, { data: setlistSongs }, { data: allSongs }] = await Promise.all([
    supabase.from('setlists').select('*').eq('id', id).single(),
    supabase
      .from('setlist_songs')
      .select('*, song:songs(*)')
      .eq('setlist_id', id)
      .order('position'),
    supabase.from('songs').select('*').order('title'),
  ])

  if (!setlist) notFound()

  const date = setlist.show_date
    ? new Date(setlist.show_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const currentSongIds = setlistSongs?.map(ss => ss.song_id) ?? []
  const currentSongTitles = setlistSongs?.map(ss => ss.song.title) ?? []

  return (
    <div className="max-w-2xl">
      <Link href="/setlists" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Setlists
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{setlist.title}</h1>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
            {date && <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{date}</span>}
            {setlist.venue && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{setlist.venue}</span>}
          </div>
          {setlist.notes && <p className="mt-2 text-sm text-gray-500 italic">{setlist.notes}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SaveOfflineButton
            setlistTitle={setlist.title}
            showDate={setlist.show_date}
            venue={setlist.venue}
            items={(setlistSongs ?? []).map(ss => ({ song: ss.song, section: (ss as SetlistSongWithSong).section }))}
          />
          <SetlistPdfExport setlist={setlist} songs={setlistSongs?.map(ss => ss.song) ?? []} />
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/setlists/${id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link>
          </Button>
          <DeleteSetlistButton id={id} />
        </div>
      </div>

      {/* Song count + action buttons */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-500">
          {setlistSongs?.length ?? 0} {setlistSongs?.length === 1 ? 'song' : 'songs'}
        </p>
        <div className="flex gap-2">
          <BulkImportModal
            setlistId={id}
            existingSongs={allSongs ?? []}
            currentSongTitles={currentSongTitles}
          />
          <AddSongToSetlistModal
            setlistId={id}
            allSongs={allSongs ?? []}
            currentSongIds={currentSongIds}
          />
        </div>
      </div>

      {/* Drag-and-drop song list */}
      <SetlistSongList
        setlistId={id}
        initialItems={(setlistSongs ?? []) as SetlistSongWithSong[]}
      />
    </div>
  )
}
