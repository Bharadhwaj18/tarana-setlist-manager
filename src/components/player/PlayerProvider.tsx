'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { Pause, Play, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SOURCE_NAMES, type PlayableSong } from '@/lib/song-references'
import { EmbedPlayer } from '@/components/references/EmbedPlayer'
import { ServiceMark } from '@/components/references/ServiceMark'

interface PlayerContextValue {
  /** The song in the mini player, if any. */
  current: PlayableSong | null
  play: (song: PlayableSong) => void
  close: () => void
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider')
  return ctx
}

/**
 * Holds the mini player for the whole app. It sits in the app layout, outside the page fade, so a song keeps
 * playing while you move between pages.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<PlayableSong | null>(null)
  const value = useMemo<PlayerContextValue>(() => ({ current, play: setCurrent, close: () => setCurrent(null) }), [current])

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {current?.reference && <MiniPlayer song={current} onClose={() => setCurrent(null)} />}
    </PlayerContext.Provider>
  )
}

function MiniPlayer({ song, onClose }: { song: PlayableSong; onClose: () => void }) {
  const ref = song.reference!
  return (
    <div role="region" aria-label={`Now playing: ${song.title}`}
      className="animate-sheet-up fixed inset-x-2 bottom-[calc(4.4rem+env(safe-area-inset-bottom))] z-40 overflow-hidden rounded-2xl bg-hero p-2 text-hero-fg shadow-xl lg:inset-x-auto lg:bottom-4 lg:right-4 lg:w-[400px]">
      <div className="flex items-center gap-2">
        {ref.source === 'youtube' && <EmbedPlayer key={ref.id} reference={ref} size="compact" autoPlay />}
        {ref.source === 'youtube' && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold">{song.title}</span>
            <span className="flex items-center gap-1 text-xs font-semibold opacity-80"><ServiceMark source={ref.source} size={12} />{ref.label}</span>
          </span>
        )}
        {ref.source !== 'youtube' && (
          <div className="min-w-0 flex-1">
            <EmbedPlayer key={ref.id} reference={ref} size="compact" autoPlay className="bg-black/20" />
          </div>
        )}
        <button type="button" onClick={onClose} aria-label="Close player"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl opacity-80 hover:bg-white/10 hover:opacity-100">
          <X className="h-5 w-5" />
        </button>
      </div>
      <p className="sr-only">{ref.label} on {SOURCE_NAMES[ref.source]}</p>
    </div>
  )
}

/** Keeps the bottom of a page clear of the mini player while it's open. */
export function PlayerSpacer() {
  const { current } = usePlayer()
  return current ? <div aria-hidden className="h-24 lg:h-0" /> : null
}

/** The play button on a song row: starts that song's first reference in the mini player, or closes it again. */
export function PlayButton({ song, className }: { song: PlayableSong; className?: string }) {
  const { current, play, close } = usePlayer()
  const playing = current?.songId === song.songId
  return (
    <button type="button" onClick={() => (playing ? close() : play(song))}
      aria-label={playing ? `Stop ${song.title}` : `Play ${song.title}`} aria-pressed={playing}
      className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors', playing ? 'bg-brand-600 text-white' : 'border border-brand-200 text-gray-800 hover:bg-brand-50', className)}>
      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
    </button>
  )
}
