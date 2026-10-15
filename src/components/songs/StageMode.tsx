'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, ListMusic, Minus, Pause, Pencil, Play, Plus, RotateCcw, Save,
  SlidersHorizontal, StickyNote, X, ArrowDownToLine, ArrowRight, Moon, Sun,
} from 'lucide-react'
import { useFullscreen } from '@/hooks/useFullscreen'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import { useSwipe } from '@/lib/use-swipe'
import { parseSong } from '@/lib/chords/parser'
import { formatSong, formatSongAsChordPro } from '@/lib/chords/formatter'
import { transposeSong, transposeKey } from '@/lib/chords/transposer'
import { getStageChordSheetCss } from '@/lib/chords/theme'
import { ensureChordSheetCss } from './chordSheetStyles'
import { saveTranspose } from '@/actions/songs'
import { reorderSetlistSongs } from '@/actions/setlists'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'

export interface SetlistNavSong {
  id: string
  title: string
  chord_chart: string
  song_key: string | null
  bpm: number | null
  notes?: string | null
  section?: string | null
}

interface Props {
  /** The songs to move through, in order. A single song when opened outside a setlist. */
  songs: SetlistNavSong[]
  startSongId: string
  setlistId?: string
  setlistTitle?: string
  onClose: () => void
}

type StageTheme = 'dark' | 'light'
type Sheet = null | 'tools' | 'list' | 'edit'

const CSS_ID = 'stage-sheet-css'
const FONT_MIN = 14
const FONT_MAX = 48
const SPEED_BASE = 40
const PREF_FONT = 'stage-font-size'
const PREF_THEME = 'stage-theme'

// Fixed palettes, deliberately independent of the app's light/dark theme.
const PALETTES: Record<StageTheme, React.CSSProperties> = {
  dark: {
    '--stage-bg': '#0a0d0b', '--stage-surface': '#161b18', '--stage-raised': '#202723', '--stage-line': 'rgba(255,255,255,0.12)',
    '--stage-text': '#f4f4ef', '--stage-muted': '#a1a8a3', '--stage-chord': '#fbbf24', '--stage-section': '#6ee7b7',
    '--stage-accent': '#fbbf24', '--stage-accent-fg': '#111111',
  } as React.CSSProperties,
  light: {
    '--stage-bg': '#ffffff', '--stage-surface': '#f2f4f1', '--stage-raised': '#e6eae6', '--stage-line': 'rgba(0,0,0,0.12)',
    '--stage-text': '#0f1411', '--stage-muted': '#59615c', '--stage-chord': '#b45309', '--stage-section': '#047857',
    '--stage-accent': '#14392b', '--stage-accent-fg': '#ffffff',
  } as React.CSSProperties,
}

const readPref = <T,>(key: string, fallback: T, parse: (v: string) => T | null): T => {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : parse(v) ?? fallback
  } catch { return fallback }
}
const writePref = (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* private mode */ } }

const btn = 'flex items-center justify-center rounded-xl transition-colors active:scale-[0.97] disabled:opacity-30'
const iconBtn = cn(btn, 'h-12 w-12 text-[var(--stage-text)] hover:bg-[var(--stage-raised)]')

/**
 * One full-screen mode for playing live: the chart big and readable, the next song one tap or swipe
 * away, and every last-minute change (key, text size, the chart itself, the running order) reachable
 * without leaving the stage.
 */
export function StageMode({ songs: initialSongs, startSongId, setlistId, setlistTitle, onClose }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [mounted, setMounted] = useState(false)
  const [songs, setSongs] = useState(initialSongs)
  const [idx, setIdx] = useState(() => Math.max(0, initialSongs.findIndex(s => s.id === startSongId)))
  const [semitones, setSemitones] = useState(0)
  const [theme, setTheme] = useState<StageTheme>(() => readPref<StageTheme>(PREF_THEME, 'dark', v => (v === 'light' || v === 'dark' ? v : null)))
  const [fontSize, setFontSize] = useState(() => readPref(PREF_FONT, 26, v => { const n = Number(v); return n >= FONT_MIN && n <= FONT_MAX ? n : null }))
  const [sheet, setSheet] = useState<Sheet>(null)
  const [barsVisible, setBarsVisible] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, startSaving] = useTransition()

  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { enter, exit } = useFullscreen(rootRef)
  const { isScrolling, setIsScrolling, speed, setSpeed, resetScroll } = useAutoScroll(scrollRef)

  const song = songs[idx]
  const total = songs.length
  const prev = idx > 0 ? songs[idx - 1] : null
  const next = idx < total - 1 ? songs[idx + 1] : null
  const currentKey = semitones === 0 ? song.song_key : transposeKey(song.song_key, semitones)
  const html = useMemo(() => {
    const parsed = parseSong(song.chord_chart)
    return formatSong(semitones === 0 ? parsed : transposeSong(parsed, semitones))
  }, [song.chord_chart, semitones])

  // Mount: portal target, fullscreen, keep the screen awake.
  useEffect(() => {
    // createPortal needs document.body, which only exists after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    ensureChordSheetCss()
    enter()
    let wakeLock: WakeLockSentinel | null = null
    if ('wakeLock' in navigator) navigator.wakeLock.request('screen').then(wl => { wakeLock = wl }).catch(() => {})
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      wakeLock?.release().catch(() => {})
      document.body.style.overflow = prevOverflow
      document.getElementById(CSS_ID)?.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let el = document.getElementById(CSS_ID)
    if (!el) { el = document.createElement('style'); el.id = CSS_ID; document.head.appendChild(el) }
    el.textContent = getStageChordSheetCss(fontSize)
  }, [fontSize])

  // Bars stay up unless the chart is scrolling by itself; then they fade after a moment.
  const pokeBars = useCallback(() => {
    setBarsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (isScrolling) hideTimer.current = setTimeout(() => setBarsVisible(false), 3000)
  }, [isScrolling])
  useEffect(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (isScrolling) hideTimer.current = setTimeout(() => setBarsVisible(false), 3000)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setBarsVisible(true)
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current) }
  }, [isScrolling])

  const goTo = useCallback((i: number) => {
    if (i < 0 || i >= songs.length) return
    setIdx(i)
    setSemitones(0)
    setAtEnd(false)
    resetScroll()
    setSheet(null)
    setBarsVisible(true)
  }, [songs.length, resetScroll])

  const close = useCallback(async () => {
    await exit()
    onClose()
  }, [exit, onClose])

  const changeFont = (delta: number) => setFontSize(f => {
    const n = Math.min(FONT_MAX, Math.max(FONT_MIN, f + delta))
    writePref(PREF_FONT, String(n))
    return n
  })
  const changeSpeed = (deltaPct: number) => setSpeed(s => {
    const pct = Math.min(300, Math.max(20, Math.round((s / SPEED_BASE) * 100) + deltaPct))
    return (SPEED_BASE * pct) / 100
  })
  const changeTheme = (t: StageTheme) => { setTheme(t); writePref(PREF_THEME, t) }

  // Keyboard and Bluetooth page-turner pedals (which send arrows or Page Up/Down).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet === 'edit' || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key) {
        case ' ': e.preventDefault(); setIsScrolling(!isScrolling); break
        case 'ArrowRight': case 'PageDown': e.preventDefault(); goTo(idx + 1); break
        case 'ArrowLeft': case 'PageUp': e.preventDefault(); goTo(idx - 1); break
        case 'Escape': if (sheet) setSheet(null); else close(); break
        case '+': case '=': setSemitones(n => n + 1); break
        case '-': setSemitones(n => n - 1); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet, isScrolling, setIsScrolling, idx, goTo, close])

  const swipe = useSwipe(() => goTo(idx + 1), () => goTo(idx - 1))

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setAtEnd(el.scrollHeight > el.clientHeight + 40 && el.scrollTop + el.clientHeight >= el.scrollHeight - 80)
  }

  // ---- Last-minute changes -------------------------------------------------------------

  const saveKey = () => {
    const chart = formatSongAsChordPro(transposeSong(parseSong(song.chord_chart), semitones))
    startSaving(async () => {
      const res = await saveTranspose(song.id, chart, currentKey ?? null)
      if (res.error) { toast(res.error, 'error'); return }
      setSongs(list => list.map((s, i) => (i === idx ? { ...s, chord_chart: chart, song_key: currentKey ?? s.song_key } : s)))
      setSemitones(0)
      toast(`Saved in ${currentKey}`, 'success')
      router.refresh()
    })
  }

  const openEditor = () => {
    setDraft(semitones === 0 ? song.chord_chart : formatSongAsChordPro(transposeSong(parseSong(song.chord_chart), semitones)))
    setSheet('edit')
    setIsScrolling(false)
  }
  const saveEdit = () => {
    startSaving(async () => {
      const res = await saveTranspose(song.id, draft, currentKey ?? null)
      if (res.error) { toast(res.error, 'error'); return }
      setSongs(list => list.map((s, i) => (i === idx ? { ...s, chord_chart: draft, song_key: currentKey ?? s.song_key } : s)))
      setSemitones(0)
      setSheet(null)
      toast('Song saved', 'success')
      router.refresh()
    })
  }

  const reorder = (from: number, to: number) => {
    if (!setlistId || from === to) return
    const list = [...songs]
    const [moved] = list.splice(from, 1)
    list.splice(to, 0, moved)
    const playing = songs[idx].id
    setSongs(list)
    setIdx(list.findIndex(s => s.id === playing))
    startSaving(async () => {
      try {
        await reorderSetlistSongs(setlistId, list.map(s => ({ songId: s.id, section: s.section ?? null })))
        toast(`Moved “${moved.title}”`, 'success')
      } catch {
        toast('Couldn’t save the new order. It’s changed here only.', 'error')
      }
    })
  }

  if (!mounted) return null

  const speedPct = Math.round((speed / SPEED_BASE) * 100)

  return createPortal(
    <div ref={rootRef} style={PALETTES[theme]}
      className="fixed inset-0 z-[200] flex flex-col bg-[var(--stage-bg)] text-[var(--stage-text)]"
      onPointerDown={pokeBars}>

      {/* Top bar */}
      <header className={cn('flex shrink-0 items-center gap-1 border-b border-[var(--stage-line)] bg-[var(--stage-surface)] px-2 py-2 transition-all duration-300 sm:px-3',
        !barsVisible && '-mt-16 opacity-0')}>
        <button type="button" onClick={close} aria-label="Leave stage mode" title="Leave (Esc)" className={iconBtn}><X className="h-6 w-6" /></button>
        <div className="min-w-0 flex-1 px-1">
          <h1 className="truncate text-lg font-bold leading-tight sm:text-xl">{song.title}</h1>
          <p className="truncate text-xs text-[var(--stage-muted)] sm:text-sm">
            {[total > 1 && `${idx + 1} of ${total}`, setlistTitle, song.bpm && `${song.bpm} BPM`].filter(Boolean).join(' · ')}
          </p>
        </div>
        {currentKey && (
          <button type="button" onClick={() => setSheet('tools')} title="Change key"
            className="shrink-0 rounded-lg bg-[var(--stage-raised)] px-3 py-1.5 text-base font-extrabold text-[var(--stage-chord)]">
            {currentKey}{semitones !== 0 && <span className="ml-1 text-xs text-[var(--stage-muted)]">{semitones > 0 ? `+${semitones}` : semitones}</span>}
          </button>
        )}
        {song.notes && (
          <button type="button" onClick={() => setSheet('tools')} aria-label="Band notes" title="Band notes" className={iconBtn}><StickyNote className="h-5 w-5" /></button>
        )}
        {total > 1 && <button type="button" onClick={() => setSheet('list')} aria-label="Running order" title="Running order" className={iconBtn}><ListMusic className="h-6 w-6" /></button>}
        <button type="button" onClick={() => setSheet('tools')} aria-label="Tools" title="Key, text size and more" className={iconBtn}><SlidersHorizontal className="h-6 w-6" /></button>
      </header>

      {/* The chart */}
      <div ref={scrollRef} onScroll={onScroll} {...swipe} className="stage-sheet relative flex-1 overflow-y-auto overscroll-contain">
        {song.chord_chart.trim() ? (
          <div className="mx-auto max-w-4xl px-5 pb-48 pt-6 sm:px-10" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-[var(--stage-muted)]">
            <p className="text-lg">No chart for this song yet.</p>
            <button type="button" onClick={openEditor} className="rounded-xl bg-[var(--stage-accent)] px-5 py-3 font-bold text-[var(--stage-accent-fg)]">Add it now</button>
          </div>
        )}
      </div>

      {/* Up next, once the end of the chart is reached */}
      {next && atEnd && sheet === null && (
        <button type="button" onClick={() => goTo(idx + 1)}
          className="absolute inset-x-4 bottom-28 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-[var(--stage-accent)] px-5 py-4 text-left text-[var(--stage-accent-fg)] shadow-2xl sm:bottom-32">
          <span className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-[0.12em] opacity-75">Up next</span>
            <span className="block truncate text-xl font-extrabold">{next.title}</span>
          </span>
          <ArrowRight className="h-7 w-7 shrink-0" />
        </button>
      )}

      {/* Bottom bar */}
      <footer className={cn('absolute inset-x-0 bottom-0 border-t border-[var(--stage-line)] bg-[var(--stage-surface)] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 transition-all duration-300 sm:px-4',
        !barsVisible && 'pointer-events-none translate-y-full opacity-0')}>
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <button type="button" onClick={() => goTo(idx - 1)} disabled={!prev} aria-label="Previous song"
            className={cn(btn, 'h-14 min-w-14 gap-2 bg-[var(--stage-raised)] px-3 text-[var(--stage-text)] sm:min-w-44 sm:justify-start')}>
            <ChevronLeft className="h-7 w-7 shrink-0" />
            <span className="hidden min-w-0 truncate text-sm font-semibold sm:block">{prev?.title}</span>
          </button>

          <div className="flex flex-1 items-center justify-center gap-1">
            <button type="button" onClick={() => changeSpeed(-10)} aria-label="Scroll slower" className={cn(btn, 'h-14 w-11 text-[var(--stage-text)] hover:bg-[var(--stage-raised)]')}><Minus className="h-5 w-5" /></button>
            <button type="button" onClick={() => setIsScrolling(!isScrolling)}
              className={cn(btn, 'h-14 min-w-28 gap-2 bg-[var(--stage-accent)] px-4 text-base font-extrabold text-[var(--stage-accent-fg)]')}>
              {isScrolling ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              <span className="flex flex-col items-start leading-none">
                <span>{isScrolling ? 'Pause' : 'Scroll'}</span>
                <span className="mt-0.5 text-[11px] font-bold opacity-75">{speedPct}%</span>
              </span>
            </button>
            <button type="button" onClick={() => changeSpeed(10)} aria-label="Scroll faster" className={cn(btn, 'h-14 w-11 text-[var(--stage-text)] hover:bg-[var(--stage-raised)]')}><Plus className="h-5 w-5" /></button>
          </div>

          <button type="button" onClick={() => goTo(idx + 1)} disabled={!next} aria-label="Next song"
            className={cn(btn, 'h-14 min-w-14 gap-2 bg-[var(--stage-raised)] px-3 text-[var(--stage-text)] sm:min-w-44 sm:justify-end')}>
            <span className="hidden min-w-0 truncate text-sm font-semibold sm:block">{next?.title}</span>
            <ChevronRight className="h-7 w-7 shrink-0" />
          </button>
        </div>
        <p className="mt-1.5 hidden text-center text-[11px] text-[var(--stage-muted)] lg:block">Space scroll · ← → or pedal to change song · + − key · Esc leave</p>
      </footer>

      {/* Sheets */}
      {sheet && sheet !== 'edit' && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setSheet(null)}>
          <div onClick={e => e.stopPropagation()}
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border border-[var(--stage-line)] bg-[var(--stage-surface)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{sheet === 'list' ? 'Running order' : 'On-stage tools'}</h2>
              <button type="button" onClick={() => setSheet(null)} aria-label="Close" className={cn(btn, 'h-10 w-10 hover:bg-[var(--stage-raised)]')}><X className="h-5 w-5" /></button>
            </div>

            {sheet === 'tools' && (
              <div className="space-y-5">
                {song.notes && (
                  <div className="rounded-2xl bg-[var(--stage-raised)] p-4">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--stage-section)]"><StickyNote className="h-3.5 w-3.5" /> Band notes</p>
                    <p className="whitespace-pre-wrap text-base">{song.notes}</p>
                  </div>
                )}

                <ToolRow label="Key" hint={song.song_key ? `Written in ${song.song_key}` : undefined}>
                  <Stepper onMinus={() => setSemitones(n => n - 1)} onPlus={() => setSemitones(n => n + 1)}
                    value={<>{currentKey ?? '—'}{semitones !== 0 && <span className="ml-1 text-xs text-[var(--stage-muted)]">{semitones > 0 ? `+${semitones}` : semitones}</span>}</>} />
                </ToolRow>
                {semitones !== 0 && (
                  <div className="-mt-2 flex gap-2">
                    <button type="button" onClick={saveKey} disabled={saving} className={cn(btn, 'h-11 flex-1 gap-2 bg-[var(--stage-accent)] font-bold text-[var(--stage-accent-fg)]')}>
                      <Save className="h-4 w-4" /> Save {currentKey} as the song’s key
                    </button>
                    <button type="button" onClick={() => setSemitones(0)} className={cn(btn, 'h-11 gap-2 bg-[var(--stage-raised)] px-4 font-bold')}><RotateCcw className="h-4 w-4" /> Reset</button>
                  </div>
                )}

                <ToolRow label="Text size">
                  <Stepper onMinus={() => changeFont(-2)} onPlus={() => changeFont(2)} value={<>{fontSize}</>} minusLabel="A−" plusLabel="A+" />
                </ToolRow>

                <ToolRow label="Scroll speed">
                  <Stepper onMinus={() => changeSpeed(-10)} onPlus={() => changeSpeed(10)} value={<>{speedPct}%</>} />
                </ToolRow>

                <ToolRow label="Display">
                  <div className="flex rounded-xl bg-[var(--stage-raised)] p-1">
                    {([['dark', 'Dark', Moon], ['light', 'Light', Sun]] as const).map(([v, l, Icon]) => (
                      <button key={v} type="button" onClick={() => changeTheme(v)} aria-pressed={theme === v}
                        className={cn('flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-bold', theme === v ? 'bg-[var(--stage-accent)] text-[var(--stage-accent-fg)]' : 'text-[var(--stage-muted)]')}>
                        <Icon className="h-4 w-4" /> {l}
                      </button>
                    ))}
                  </div>
                </ToolRow>

                <div className="grid grid-cols-2 gap-2 border-t border-[var(--stage-line)] pt-4">
                  <button type="button" onClick={openEditor} className={cn(btn, 'h-12 gap-2 bg-[var(--stage-raised)] font-bold')}><Pencil className="h-4 w-4" /> Edit this chart</button>
                  <button type="button" onClick={() => { resetScroll(); setSheet(null) }} className={cn(btn, 'h-12 gap-2 bg-[var(--stage-raised)] font-bold')}><ArrowDownToLine className="h-4 w-4 rotate-180" /> Back to top</button>
                </div>
              </div>
            )}

            {sheet === 'list' && (
              <ol className="space-y-1">
                {songs.map((s, i) => {
                  const showSection = s.section && s.section !== songs[i - 1]?.section
                  return (
                    <li key={s.id}>
                      {showSection && <p className="px-2 pb-1 pt-3 text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--stage-section)]">{s.section}</p>}
                      <div className={cn('flex items-center gap-2 rounded-xl', i === idx ? 'bg-[var(--stage-accent)] text-[var(--stage-accent-fg)]' : 'hover:bg-[var(--stage-raised)]')}>
                        <button type="button" onClick={() => goTo(i)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left">
                          <span className="w-6 shrink-0 text-right text-sm font-bold opacity-60">{i + 1}</span>
                          <span className="min-w-0 truncate text-base font-semibold">{s.title}</span>
                          {s.song_key && <span className="shrink-0 text-xs font-bold opacity-70">{s.song_key}</span>}
                          {i === idx && <span className="ml-auto shrink-0 text-[11px] font-extrabold uppercase tracking-[0.1em]">Now</span>}
                        </button>
                        {setlistId && i !== idx && (
                          <div className="flex shrink-0 gap-1 pr-2">
                            {i !== idx + 1 && (
                              <button type="button" disabled={saving} onClick={() => reorder(i, i < idx ? idx : idx + 1)}
                                className="rounded-lg bg-[var(--stage-raised)] px-2.5 py-1.5 text-xs font-bold text-[var(--stage-text)]">Play next</button>
                            )}
                            {i < total - 1 && (
                              <button type="button" disabled={saving} onClick={() => reorder(i, total - 1)}
                                className="rounded-lg px-2 py-1.5 text-xs font-bold text-[var(--stage-muted)] hover:bg-[var(--stage-raised)]">To end</button>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </div>
      )}

      {sheet === 'edit' && (
        <div className="absolute inset-0 z-10 flex flex-col bg-[var(--stage-bg)]">
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--stage-line)] bg-[var(--stage-surface)] px-3 py-2">
            <button type="button" onClick={() => setSheet(null)} className={cn(btn, 'h-11 px-3 font-bold hover:bg-[var(--stage-raised)]')}>Cancel</button>
            <p className="min-w-0 flex-1 truncate text-center text-sm font-bold">Editing {song.title}{currentKey ? ` · ${currentKey}` : ''}</p>
            <button type="button" onClick={saveEdit} disabled={saving} className={cn(btn, 'h-11 gap-2 bg-[var(--stage-accent)] px-4 font-bold text-[var(--stage-accent-fg)]')}><Save className="h-4 w-4" /> Save</button>
          </div>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} spellCheck={false} aria-label="Chord chart"
            className="flex-1 resize-none bg-[var(--stage-bg)] p-5 font-mono text-base leading-relaxed text-[var(--stage-text)] focus:outline-none" />
          <p className="shrink-0 border-t border-[var(--stage-line)] px-4 py-2 text-xs text-[var(--stage-muted)]">Chords go in square brackets before the word, e.g. [G]Hello [C]world. Saving updates the song for everyone.</p>
        </div>
      )}
    </div>,
    document.body
  )
}

function ToolRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-base font-bold">{label}</p>
        {hint && <p className="text-xs text-[var(--stage-muted)]">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function Stepper({ onMinus, onPlus, value, minusLabel, plusLabel }: { onMinus: () => void; onPlus: () => void; value: React.ReactNode; minusLabel?: string; plusLabel?: string }) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-[var(--stage-raised)] p-1">
      <button type="button" onClick={onMinus} aria-label="Less" className={cn(btn, 'h-11 w-12 text-base font-extrabold hover:bg-[var(--stage-line)]')}>{minusLabel ?? <Minus className="h-5 w-5" />}</button>
      <span className="min-w-16 text-center text-lg font-extrabold">{value}</span>
      <button type="button" onClick={onPlus} aria-label="More" className={cn(btn, 'h-11 w-12 text-base font-extrabold hover:bg-[var(--stage-line)]')}>{plusLabel ?? <Plus className="h-5 w-5" />}</button>
    </div>
  )
}
