'use client'

import { ChevronLeft, ChevronRight, SkipBack, Play, Pause, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SetlistNavSong } from './PerformanceMode'

interface PerformanceControlsProps {
  visible: boolean
  currentKey: string | null
  currentIdx: number
  isScrolling: boolean
  speed: number
  isFullscreen: boolean
  setlistSongs?: SetlistNavSong[]
  onPlay: () => void
  onPause: () => void
  onReset: () => void
  onSpeedChange: (v: number) => void
  onTransposeUp: () => void
  onTransposeDown: () => void
  onFullscreenToggle: () => void
  onNavigate: (idx: number) => void
  fontSize: number
  onFontSizeChange: (v: number) => void
}

const FONT_SIZES = [18, 24, 32]
const FONT_LABELS = ['S', 'M', 'L']

export function PerformanceControls({
  visible, currentKey, currentIdx, isScrolling, speed, isFullscreen,
  setlistSongs, onPlay, onPause, onReset, onSpeedChange,
  onTransposeUp, onTransposeDown, onFullscreenToggle, onNavigate,
  fontSize, onFontSizeChange,
}: PerformanceControlsProps) {
  const total = setlistSongs?.length ?? 0
  const prevSong = currentIdx > 0 && total > 0 ? setlistSongs![currentIdx - 1] : null
  const nextSong = currentIdx >= 0 && currentIdx < total - 1 ? setlistSongs![currentIdx + 1] : null

  return (
    <div className={cn(
      'absolute inset-x-0 bottom-0 transition-all duration-300',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
    )}>
      {/* Gradient */}
      <div className="h-20 bg-gradient-to-t from-black/95 to-transparent pointer-events-none" />

      <div className="border-t border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 py-3 lg:px-8">

          {/* Nav row: prev / controls / next */}
          <div className="flex items-center gap-3">

            {/* Prev */}
            <button
              onClick={() => prevSong && onNavigate(currentIdx - 1)}
              disabled={!prevSong}
              className="group flex min-w-0 shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-20 lg:min-w-[160px]"
              title="Previous (←)"
            >
              <ChevronLeft className="h-5 w-5 shrink-0" />
              <span className="hidden truncate text-xs lg:inline">{prevSong?.title ?? ''}</span>
            </button>

            {/* Center controls */}
            <div className="flex flex-1 flex-wrap items-center justify-center gap-2 lg:gap-3">

              {/* Reset */}
              <button
                onClick={onReset}
                className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                title="Back to top (↑)"
              >
                <SkipBack className="h-4 w-4" />
              </button>

              {/* Play / Pause */}
              <button
                onClick={isScrolling ? onPause : onPlay}
                className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-amber-400 lg:px-5 lg:py-2.5 lg:text-base"
                title="Play / Pause (Space)"
              >
                {isScrolling
                  ? <><Pause className="h-4 w-4" /> Pause</>
                  : <><Play className="h-4 w-4" /> Scroll</>
                }
              </button>

              {/* Speed */}
              <div className="flex items-center gap-2">
                <span className="hidden text-xs font-medium text-white/40 lg:inline">Speed</span>
                <input
                  type="range" min={10} max={120} step={5} value={speed}
                  onChange={e => onSpeedChange(Number(e.target.value))}
                  className="h-1 w-24 cursor-pointer accent-amber-400 lg:w-36"
                  title={`${speed} px/s`}
                />
              </div>

              {/* Divider */}
              <div className="hidden h-6 w-px bg-white/10 lg:block" />

              {/* Transpose */}
              <div className="flex items-center gap-1">
                <button
                  onClick={onTransposeDown}
                  className="rounded-lg px-2.5 py-1.5 text-lg font-bold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  title="Transpose down (−)"
                >−</button>
                <span className="min-w-[4rem] text-center text-xs font-semibold text-white/50">
                  {currentKey ? `Key ${currentKey}` : 'Key'}
                </span>
                <button
                  onClick={onTransposeUp}
                  className="rounded-lg px-2.5 py-1.5 text-lg font-bold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  title="Transpose up (+)"
                >+</button>
              </div>

              {/* Font size */}
              <div className="flex items-center gap-0.5 rounded-lg bg-white/5 p-1">
                {FONT_SIZES.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => onFontSizeChange(s)}
                    className={cn(
                      'rounded-md px-2 py-1 text-xs font-bold transition-colors',
                      fontSize === s
                        ? 'bg-white/20 text-white'
                        : 'text-white/30 hover:text-white/60'
                    )}
                  >
                    {FONT_LABELS[i]}
                  </button>
                ))}
              </div>

              {/* Fullscreen */}
              <button
                onClick={onFullscreenToggle}
                className="hidden rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white lg:block"
                title="Toggle fullscreen"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>

            {/* Next */}
            <button
              onClick={() => nextSong && onNavigate(currentIdx + 1)}
              disabled={!nextSong}
              className="group flex min-w-0 shrink-0 items-center justify-end gap-1.5 rounded-lg px-2 py-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-20 lg:min-w-[160px]"
              title="Next (→)"
            >
              <span className="hidden truncate text-xs lg:inline">{nextSong?.title ?? ''}</span>
              <ChevronRight className="h-5 w-5 shrink-0" />
            </button>
          </div>

          {/* Keyboard hint — desktop only */}
          <p className="mt-1.5 hidden text-center text-xs text-white/20 lg:block">
            Space · ←→ navigate · +/− transpose · Esc close
          </p>

        </div>
      </div>
    </div>
  )
}
