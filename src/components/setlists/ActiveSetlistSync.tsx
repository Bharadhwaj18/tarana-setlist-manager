'use client'

import { useEffect } from 'react'
import { ACTIVE_SETLIST_COOKIE, ACTIVE_SETLIST_COOKIE_MAX_AGE } from '@/lib/setlist-context'

/**
 * Marks a setlist as the "active" one — renders nothing, just keeps the
 * fallback cookie in sync whenever this setlist (or a song opened from it)
 * is viewed. See lib/setlist-context.ts for why this exists.
 */
export function ActiveSetlistSync({ setlistId }: { setlistId: string | null }) {
  useEffect(() => {
    if (!setlistId) return
    document.cookie = `${ACTIVE_SETLIST_COOKIE}=${setlistId}; path=/; max-age=${ACTIVE_SETLIST_COOKIE_MAX_AGE}`
  }, [setlistId])

  return null
}
