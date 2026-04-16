import Link from 'next/link'
import { Music2, Clock, Hash } from 'lucide-react'
import type { Song } from '@/types'

interface SongCardProps {
  song: Song
  createdBy?: string
  updatedBy?: string
}

export function SongCard({ song, createdBy, updatedBy }: SongCardProps) {
  return (
    <Link
      href={`/songs/${song.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-brand-200 bg-white p-5 shadow-sm transition-all hover:border-brand-400 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-gray-900 group-hover:text-brand-600">{song.title}</h3>
          {song.artist && <p className="truncate text-sm text-gray-500">{song.artist}</p>}
        </div>
        {song.song_key && (
          <span className="shrink-0 rounded-md bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">
            {song.song_key}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-400">
        {song.bpm && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {song.bpm} BPM
          </span>
        )}
        {song.time_signature && (
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" /> {song.time_signature}
          </span>
        )}
        {!song.chord_chart && (
          <span className="italic text-gray-300">No chords yet</span>
        )}
      </div>
      {(createdBy || updatedBy) && (
        <div className="border-t border-gray-100 pt-2 text-xs text-gray-400">
          {updatedBy
            ? <span>Edited by <span className="font-medium text-gray-500">{updatedBy}</span></span>
            : <span>Added by <span className="font-medium text-gray-500">{createdBy}</span></span>
          }
        </div>
      )}
    </Link>
  )
}
