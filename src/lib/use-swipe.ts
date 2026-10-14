import type { TouchEvent } from 'react'
import { useRef } from 'react'

const MIN_DISTANCE = 60

/** Horizontal swipe detection for a touch screen: spread the returned handlers onto an element. */
export function useSwipe(onLeft: () => void, onRight: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null)

  return {
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0]
      start.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null
    },
    onTouchEnd: (e: TouchEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      const t = e.changedTouches[0]
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      // A deliberate sideways swipe, not a scroll that drifted.
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (dx < 0) onLeft()
      else onRight()
    },
  }
}
