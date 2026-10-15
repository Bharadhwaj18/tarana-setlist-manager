'use client'

import { useLayoutEffect, useRef } from 'react'

/**
 * Rolls a number up from zero to `value` when it first shows, and again when it changes.
 * Writes each frame straight into the text, so it never re-renders the page. Under reduced motion the final value shows at once.
 */
export function CountUp({ value, format, duration = 900 }: { value: number; format: (n: number) => string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const formatRef = useRef(format)

  useLayoutEffect(() => {
    formatRef.current = format
  })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = formatRef.current(value); return }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      el.textContent = formatRef.current(value * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    el.textContent = formatRef.current(0)
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <span ref={ref}>{format(value)}</span>
}
