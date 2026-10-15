'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

/** Each page eases in when the route changes. The wrapper keys on the path, so it replays on every navigation. */
export function PageFade({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return <div key={pathname} className="animate-fade-up">{children}</div>
}
