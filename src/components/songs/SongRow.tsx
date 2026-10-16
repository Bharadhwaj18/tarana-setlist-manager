'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, Music2, Pencil, Trash2 } from 'lucide-react'
import { LongPressMenu, type MenuItem } from '@/components/ui/LongPressMenu'
import { deleteSong } from '@/actions/songs'
import { StatusPill } from '@/components/ui/StatusPill'
import type { Song } from '@/types'
import { SOURCE_NAMES, type CoverLink, type PlayableSong } from '@/lib/song-references'
import { ServiceMark } from '@/components/references/ServiceMark'
import { Cover } from '@/components/references/Cover'
import { PlayButton } from '@/components/player/PlayerProvider'

interface SongRowProps {
  song: Song
  setlistCount: number
  /** Set when the song has a reference the app can play. */
  playable?: PlayableSong
  /** Where the cover art came from: marked on the cover and linked from the long-press menu. */
  coverLink?: CoverLink
}

export function SongRow({ song, setlistCount, playable, coverLink }: SongRowProps) {
  const router = useRouter()
  const menu: MenuItem[] = [
    { label: 'Open', href: `/songs/${song.id}`, icon: Music2 },
    { label: 'Edit', href: `/songs/${song.id}/edit`, icon: Pencil },
    ...(coverLink ? [{ label: `Open in ${SOURCE_NAMES[coverLink.source]}`, href: coverLink.url, icon: ExternalLink }] : []),
    { label: 'Delete', icon: Trash2, danger: true, onSelect: () => { if (window.confirm(`Delete "${song.title}"? This can’t be undone.`)) void deleteSong(song.id).then(r => { if (r.error) window.alert(r.error); else router.refresh() }) } },
  ]
  return (
    <LongPressMenu title={song.title} items={menu} className="flex items-center border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50">
    <Link
      href={`/songs/${song.id}`}
      className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3"
    >
      <span className="relative shrink-0">
        <Cover url={song.cover_url} title={song.title} size={44} />
        {coverLink && <span className="absolute -bottom-1 -right-1 rounded-full bg-white p-px" title={`Cover from ${SOURCE_NAMES[coverLink.source]}`}><ServiceMark source={coverLink.source} size={14} /></span>}
      </span>
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
    {playable && <PlayButton song={playable} className="mr-3" />}
    </LongPressMenu>
  )
}
