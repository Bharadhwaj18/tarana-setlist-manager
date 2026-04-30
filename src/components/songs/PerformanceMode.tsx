'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useFullscreen } from '@/hooks/useFullscreen'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import { useInactivityHide } from '@/hooks/useInactivityHide'
import { PerformanceControls } from './PerformanceControls'
import { formatSong } from '@/lib/chords/formatter'
import { parseSong } from '@/lib/chords/parser'
import { transposeSong, transposeKey } from '@/lib/chords/transposer'
import { cn } from '@/lib/utils'
import type { Song as ChordsheetSong } from 'chordsheetjs'

export interface SetlistNavSong {
  id: string
  title: string
  chord_chart: string
  song_key: string | null
  bpm: number | null
}

interface PerformanceModeProps {
  song: ChordsheetSong
  songKey: string | null
  songId: string
  songTitle: string
  bpm?: number | null
  setlistSongs?: SetlistNavSong[]
  setlistId?: string
  onClose: () => void
}

const PERF_CSS_ID = 'tarana-perf-css'

function getPerfCss(fontSize: number) {
  return `
    .perf-sheet .chord-sheet {
      font-family: 'Courier New', monospace;
      font-size: ${fontSize}px;
      line-height: 2.2;
      color: #e5e7eb;
    }
    .perf-sheet .chord {
      color: #fbbf24;
      font-weight: 700;
      font-size: ${Math.round(fontSize * 0.88)}px;
    }
    .perf-sheet .paragraph { margin-bottom: 2.5rem; }
    .perf-sheet .row { display: flex; flex-wrap: wrap; }
    .perf-sheet .column { display: flex; flex-direction: column; margin-right: 0.3rem; }
    .perf-sheet .section-label {
      color: #6ee7b7;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 0.5rem;
    }
    .perf-sheet .comment { color: #4b5563; font-style: italic; }
  `
}

export function PerformanceMode({
  song: initialSong, songKey: initialKey, songId, songTitle, bpm: initialBpm,
  setlistSongs, setlistId, onClose,
}: PerformanceModeProps) {
  const startIdx = setlistSongs?.findIndex(s => s.id === songId) ?? -1
  const [currentIdx, setCurrentIdx] = useState(startIdx)

  const [song, setSong] = useState(initialSong)
  const [activeSongKey, setActiveSongKey] = useState(initialKey)
  const [activeBpm, setActiveBpm] = useState(initialBpm ?? null)
  const [activeTitle, setActiveTitle] = useState(songTitle)
  const [semitones, setSemitones] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof localStorage === 'undefined') return 24
    return Number(localStorage.getItem('tarana-perf-font-size') ?? '24') || 24
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { isFullscreen, enter, exit } = useFullscreen(containerRef)
  const { isScrolling, setIsScrolling, speed, setSpeed, resetScroll } = useAutoScroll(scrollRef)
  const { controlsVisible, showControls } = useInactivityHide(5000)

  useEffect(() => {
    setMounted(true)
    enter()
    let wakeLock: any = null
    if ('wakeLock' in navigator) {
      (navigator as any).wakeLock.request('screen').then((wl: any) => { wakeLock = wl }).catch(() => {})
    }
    return () => { wakeLock?.release().catch(() => {}) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let el = document.getElementById(PERF_CSS_ID)
    if (!el) { el = document.createElement('style'); el.id = PERF_CSS_ID; document.head.appendChild(el) }
    el.textContent = getPerfCss(fontSize)
  }, [fontSize])

  useEffect(() => { return () => { document.getElementById(PERF_CSS_ID)?.remove() } }, [])

  const transpose = (delta: number) => {
    setSong(prev => transposeSong(prev, delta))
    setSemitones(prev => prev + delta)
  }

  const handleFontSize = (s: number) => {
    setFontSize(s)
    localStorage.setItem('tarana-perf-font-size', String(s))
  }

  const handleNavigate = useCallback((newIdx: number) => {
    if (!setlistSongs || newIdx < 0 || newIdx >= setlistSongs.length) return
    const next = setlistSongs[newIdx]
    setSong(parseSong(next.chord_chart))
    setActiveSongKey(next.song_key)
    setActiveBpm(next.bpm)
    setActiveTitle(next.title)
    setSemitones(0)
    resetScroll()
    setCurrentIdx(newIdx)
    showControls()
  }, [setlistSongs, resetScroll, showControls])

  const handleClose = useCallback(async () => {
    await exit()
    onClose()
  }, [exit, onClose])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      switch (e.key) {
        case ' ': e.preventDefault(); isScrolling ? setIsScrolling(false) : setIsScrolling(true); break
        case 'ArrowRight': case 'ArrowDown': e.preventDefault(); handleNavigate(currentIdx + 1); break
        case 'ArrowLeft': case 'ArrowUp': e.preventDefault(); handleNavigate(currentIdx - 1); break
        case 'Escape': handleClose(); break
        case '+': case '=': transpose(1); break
        case '-': transpose(-1); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isScrolling, currentIdx, handleNavigate, handleClose, setIsScrolling])

  const currentKey = semitones === 0 ? activeSongKey : transposeKey(activeSongKey, semitones)
  const html = formatSong(song)
  const total = setlistSongs?.length ?? 0

  if (!mounted) return null

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[200] flex flex-col bg-gray-950"
      onPointerMove={showControls}
      onTouchStart={showControls}
    >
      {/* ── Persistent top bar (always visible) ─────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-gray-900/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h2 className="truncate text-base font-bold text-white lg:text-lg">{activeTitle}</h2>
          {currentKey && (
            <span className="shrink-0 rounded-md bg-amber-500/20 px-2 py-0.5 text-sm font-bold text-amber-400">
              {currentKey}
            </span>
          )}
          {activeBpm && (
            <span className="hidden shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/50 sm:inline">
              {activeBpm} BPM
            </span>
          )}
          {total > 0 && (
            <span className="hidden shrink-0 text-sm text-white/30 lg:inline">
              {currentIdx + 1} <span className="text-white/20">/ {total}</span>
            </span>
          )}
        </div>
        <button
          onClick={handleClose}
          className="shrink-0 rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          title="Exit (Esc)"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── Chord sheet ────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="perf-sheet flex-1 overflow-y-auto"
        onClick={showControls}
      >
        <div
          className="mx-auto max-w-3xl px-6 pb-40 pt-8 lg:px-12 lg:pt-10"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {/* ── Auto-hide bottom controls ─────────────────── */}
      <PerformanceControls
        visible={controlsVisible}
        currentKey={currentKey}
        currentIdx={currentIdx}
        isScrolling={isScrolling}
        speed={speed}
        isFullscreen={isFullscreen}
        setlistSongs={setlistSongs}
        onPlay={() => setIsScrolling(true)}
        onPause={() => setIsScrolling(false)}
        onReset={resetScroll}
        onSpeedChange={setSpeed}
        onTransposeUp={() => transpose(1)}
        onTransposeDown={() => transpose(-1)}
        onFullscreenToggle={isFullscreen ? exit : enter}
        onNavigate={handleNavigate}
        fontSize={fontSize}
        onFontSizeChange={handleFontSize}
      />
    </div>,
    document.body
  )
}
