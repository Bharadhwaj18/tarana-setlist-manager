'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ExternalLink, Headphones, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SOURCE_NAMES, formatTime, type PlayableSong } from '@/lib/song-references'
import { usePlayer } from '@/components/player/PlayerProvider'
import { EmbedPlayer, type EmbedHandle } from './EmbedPlayer'
import { ServiceMark } from './ServiceMark'
import { Cover } from './Cover'

/**
 * Rehearse, at the top of a setlist: plays each song's reference in set order, skipping songs without one.
 * With no references yet it says how to get some, rather than hiding.
 */
export function RehearseCard({ songs }: { songs: PlayableSong[] }) {
  const [open, setOpen] = useState(false)
  const { close } = usePlayer()
  const ready = songs.filter(s => s.reference).length
  if (songs.length === 0) return null
  return (
    <section aria-label="Rehearse this set" className="mb-6 flex items-center gap-3 rounded-2xl bg-hero p-4 text-hero-fg sm:gap-4 sm:p-5">
      <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-hero-fg/10"><Headphones className="h-6 w-6" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg font-bold leading-tight">Rehearse this set</h2>
        <p className="mt-0.5 text-sm text-hero-muted">
          {ready > 0
            ? `Plays each song’s reference in order · ${ready} of ${songs.length} ${songs.length === 1 ? 'song' : 'songs'} ready`
            : 'Add a Spotify or YouTube link to a song in this set to rehearse along with it.'}
        </p>
      </div>
      {ready > 0 && (
        <button type="button" onClick={() => { close(); setOpen(true) }}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-hero-fg px-5 text-sm font-extrabold text-hero transition-opacity hover:opacity-90">
          <Play className="h-4 w-4" />Start
        </button>
      )}
      {open && <RehearseView songs={songs} onClose={() => setOpen(false)} />}
    </section>
  )
}

function RehearseView({ songs, onClose }: { songs: PlayableSong[]; onClose: () => void }) {
  const firstPlayable = songs.findIndex(s => s.reference)
  const [index, setIndex] = useState(firstPlayable)
  // Only after the first song has been started by hand do later songs try to start on their own.
  const [started, setStarted] = useState(false)
  const [activeMoment, setActiveMoment] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const player = useRef<EmbedHandle>(null)
  const song = songs[index]
  const ref = song?.reference

  const step = (dir: 1 | -1) => {
    for (let i = index + dir; i >= 0 && i < songs.length; i += dir) {
      if (songs[i].reference) { setIndex(i); setActiveMoment(null); setPlaying(false); return }
    }
  }
  const nextPlayable = songs.findIndex((s, i) => i > index && s.reference)
  let prevPlayable = -1
  for (let i = index - 1; i >= 0; i--) if (songs[i].reference) { prevPlayable = i; break }

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow }
  }, [onClose])

  if (!song || !ref) return null

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Rehearse" className="animate-sheet-up fixed inset-0 z-[150] flex flex-col bg-brand-50 dark:bg-[#0b0b0c]">
      <div className="flex items-center justify-between px-3 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} aria-label="Close rehearsal" className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-600 hover:bg-brand-100">
          <ChevronDown className="h-6 w-6" />
        </button>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-500">Rehearsing · {index + 1} of {songs.length}</span>
        <span className="w-11" />
      </div>

      <div className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div key={song.songId} className="animate-fade-up flex items-center gap-4">
          <Cover url={song.coverUrl ?? ref.thumbnailUrl} title={song.title} size={88} />
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold leading-tight text-gray-900">{song.title}</h2>
            <p className="truncate font-semibold text-gray-500">{[song.artist, song.songKey && `Key of ${song.songKey}`].filter(Boolean).join(' · ')}</p>
            <a href={ref.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-xs font-extrabold text-gray-700 hover:underline">
              <ServiceMark source={ref.source} size={14} />{ref.label} · Open in {SOURCE_NAMES[ref.source]}<ExternalLink className="h-3 w-3" />
            </a>
            {song.coverLink && song.coverLink.url !== ref.url && (
              <a href={song.coverLink.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 flex items-center gap-1 text-xs font-bold text-gray-500 hover:underline">
                <ServiceMark source={song.coverLink.source} size={12} />Cover from {SOURCE_NAMES[song.coverLink.source]}
              </a>
            )}
          </div>
        </div>

        <EmbedPlayer key={ref.id} ref={player} reference={ref} autoPlay={started} onEnded={() => { setStarted(true); step(1) }} onPlayingChange={setPlaying} />

        <div className="flex items-center justify-center gap-6">
          <button type="button" onClick={() => step(-1)} disabled={prevPlayable < 0} aria-label="Previous song"
            className="flex h-12 w-12 items-center justify-center rounded-full text-gray-800 hover:bg-brand-100 disabled:opacity-30"><SkipBack className="h-6 w-6" /></button>
          <button type="button" onClick={() => { setStarted(true); player.current?.toggle() }} aria-label={playing ? 'Pause' : 'Play'}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-white shadow-md transition-transform hover:bg-brand-700 active:scale-95">
            {playing ? <Pause className="h-7 w-7" fill="currentColor" /> : <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" />}
          </button>
          <button type="button" onClick={() => { setStarted(true); step(1) }} disabled={nextPlayable < 0} aria-label="Next song"
            className="flex h-12 w-12 items-center justify-center rounded-full text-gray-800 hover:bg-brand-100 disabled:opacity-30"><SkipForward className="h-6 w-6" /></button>
        </div>

        {ref.moments.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {ref.moments.map((m, i) => (
              <button key={`${m.at}-${m.label}`} type="button" aria-pressed={activeMoment === i} onClick={() => { setStarted(true); setActiveMoment(i); player.current?.seek(m.at) }}
                className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-extrabold', activeMoment === i ? 'bg-brand-600 text-white' : 'bg-brand-100 text-gray-800 hover:bg-brand-200')}>
                <span className="font-mono text-xs opacity-80">{formatTime(m.at)}</span>{m.label}
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-brand-200 pt-2">
          <p className="px-1 pb-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-500">Up next</p>
          {songs.slice(index + 1).map((s, offset) => {
            const i = index + 1 + offset
            return (
              <button key={`${s.songId}-${i}`} type="button" disabled={!s.reference} onClick={() => { setIndex(i); setActiveMoment(null); setPlaying(false) }}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl px-1 text-left hover:bg-brand-100 disabled:opacity-50 disabled:hover:bg-transparent">
                <span className="w-6 text-center font-mono text-sm text-gray-400">{i + 1}</span>
                <Cover url={s.coverUrl ?? s.reference?.thumbnailUrl} title={s.title} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold text-gray-900">{s.title}</span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-gray-500">
                    {s.reference ? <><ServiceMark source={s.reference.source} size={12} />{s.reference.label}</> : 'No reference, skipped'}
                  </span>
                </span>
              </button>
            )
          })}
          {index === songs.length - 1 && <p className="px-1 py-3 text-sm text-gray-500">That’s the last song in the set.</p>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
