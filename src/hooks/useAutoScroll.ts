'use client'

import { useState, useEffect, useRef, useCallback, type RefObject } from 'react'

export function useAutoScroll(scrollRef: RefObject<HTMLElement | null>) {
  const [isScrolling, setIsScrolling] = useState(false)
  const [speed, setSpeed] = useState(40) // px/sec
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isScrolling) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastTimeRef.current = null
      return
    }

    const tick = (now: number) => {
      const el = scrollRef.current
      if (!el) return
      if (lastTimeRef.current !== null) {
        const delta = (now - lastTimeRef.current) / 1000
        el.scrollTop += speed * delta
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
          setIsScrolling(false)
          return
        }
      }
      lastTimeRef.current = now
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isScrolling, speed, scrollRef])

  // Stable identity (unlike a plain inline function) so callers can safely
  // put it in their own effect/useCallback dependency arrays.
  const resetScroll = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setIsScrolling(false)
    lastTimeRef.current = null
  }, [scrollRef])

  return { isScrolling, setIsScrolling, speed, setSpeed, resetScroll }
}
