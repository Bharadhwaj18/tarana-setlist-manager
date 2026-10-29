import { SECTIONS, sectionForHref, type SectionKey } from '@/lib/workspace-sections'

/** The section page someone was last on, kept so opening the app again can pick up from there. */
export const LAST_PAGE_COOKIE = 'tarana_last_page'
/** Set (for this visit only) once the app has opened, so going to Today by hand afterwards stays on Today. */
export const VISIT_STARTED_COOKIE = 'tarana_visit_started'

/** The page to remember for a path: "/" or a section's own page ("/finance/history" is remembered as "/finance"). */
export function lastPageFor(pathname: string): string | null {
  if (pathname === '/') return '/'
  const match = SECTIONS.find(s => pathname === s.href || pathname.startsWith(`${s.href}/`))
  return match ? match.href : null
}

/**
 * Where to send someone who opens the app on Today: the section they were last in, if they can still open it.
 * Null means stay on Today.
 */
export function resumeTarget(saved: string | undefined, hidden: SectionKey[]): string | null {
  if (!saved || saved === '/') return null
  if (!SECTIONS.some(s => s.href === saved)) return null
  const section = sectionForHref(saved)
  return section && hidden.includes(section) ? null : saved
}
