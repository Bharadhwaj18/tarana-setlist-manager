import Link from 'next/link'
import { StatusPill } from '@/components/ui/StatusPill'
import type { Song } from '@/types'

interface SongRowProps {
  song: Song
  setlistCount: number
}

export function SongRow({ song, setlistCount }: SongRowProps) {
  return (
    <Link
      href={`/songs/${song.id}`}
      className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-gray-50"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-gray-900">{song.title}</p>
        {song.artist && <p className="truncate text-xs text-gray-500">{song.artist}</p>}
      </div>
      {!song.chord_chart && <StatusPill tone="amber">No chart</StatusPill>}
      {song.song_key && (
        <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">{song.song_key}</span>
      )}
      <span className="hidden w-16 text-right text-sm text-gray-500 sm:block">{song.bpm ? `${song.bpm} BPM` : '—'}</span>
      <span className={`hidden w-20 text-right text-xs sm:block ${setlistCount > 0 ? 'font-bold text-brand-600' : 'text-gray-400'}`}>
        {setlistCount} {setlistCount === 1 ? 'setlist' : 'setlists'}
      </span>
    </Link>
  )
}
