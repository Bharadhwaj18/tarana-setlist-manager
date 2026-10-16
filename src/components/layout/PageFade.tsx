'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Each page fades in when the route changes; the wrapper keys on the path, so it replays on every navigation.
 * Opacity only: a transform on this wrapper would pin every position: fixed child (floating buttons, bottom bars) to it.
 */
export function PageFade({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return <div key={pathname} className="animate-page-in">{children}</div>
}
