'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

export function useInactivityHide(timeoutMs = 4000) {
  const [controlsVisible, setControlsVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setControlsVisible(false), timeoutMs)
  }, [timeoutMs])

  useEffect(() => {
    showControls()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [showControls])

  return { controlsVisible, showControls }
}
