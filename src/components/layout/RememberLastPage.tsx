'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { LAST_PAGE_COOKIE, VISIT_STARTED_COOKIE, lastPageFor } from '@/lib/last-page'

/** Keeps a note of which section someone is in, so the next time they open the app it can start there. */
export function RememberLastPage() {
  const pathname = usePathname()

  useEffect(() => {
    // Marks this visit as started: from now on, opening Today by hand stays on Today.
    document.cookie = `${VISIT_STARTED_COOKIE}=1; path=/; samesite=lax`
    const page = lastPageFor(pathname)
    if (page) document.cookie = `${LAST_PAGE_COOKIE}=${page}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
  }, [pathname])

  return null
}
