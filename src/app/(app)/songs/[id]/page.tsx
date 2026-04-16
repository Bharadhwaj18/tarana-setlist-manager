import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Pencil, Clock, Hash, Music } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ChordViewer } from '@/components/songs/ChordViewer'
import { Button } from '@/components/ui/Button'
import { DeleteSongButton } from '@/components/songs/DeleteSongButton'
import { SongPdfExport } from '@/components/pdf/SongPdfExport'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SongPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: song } = await supabase.from('songs').select('*').eq('id', id).single()

  if (!song) notFound()

  return (
    <div className="max-w-3xl">
      <Link href="/songs" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Songs
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
            <Link href={`/songs/${id}/edit`}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </Button>
          <DeleteSongButton id={id} />
        </div>
      </div>

      {/* Notes */}
      {song.notes && (
        <div className="mb-6 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-200">
          <strong>Notes:</strong> {song.notes}
        </div>
      )}

      {/* Chord chart */}
      <ChordViewer chordChart={song.chord_chart ?? ''} songKey={song.song_key} />
    </div>
  )
}
