'use client'

import { useState, useEffect, type RefObject } from 'react'

export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const enter = async () => {
    const el = ref.current
    if (!el) return
    try {
      if (el.requestFullscreen) await el.requestFullscreen()
      else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen()
    } catch {}
  }

  const exit = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
    } catch {}
  }

  return { isFullscreen, enter, exit }
}
