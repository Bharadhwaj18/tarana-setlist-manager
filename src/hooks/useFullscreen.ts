'use client'

import { useState, useEffect, type RefObject } from 'react'

// Safari (desktop & iOS) still only exposes the vendor-prefixed method.
interface WebkitFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>
}

export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const enter = async () => {
    const el = ref.current as WebkitFullscreenElement | null
    if (!el) return
    try {
      if (el.requestFullscreen) await el.requestFullscreen()
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
    } catch {}
  }

  const exit = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
    } catch {}
  }

  return { isFullscreen, enter, exit }
}
