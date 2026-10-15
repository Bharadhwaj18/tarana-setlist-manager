/** Sections an admin can switch on or off per member. Today, Settings and the workspace page are always open. */
export const SECTIONS = [
  { key: 'shows', label: 'Shows', href: '/shows' },
  { key: 'setlists', label: 'Setlists', href: '/setlists' },
  { key: 'songs', label: 'Songs', href: '/songs' },
  { key: 'recordings', label: 'Recordings', href: '/recordings' },
  { key: 'finance', label: 'Finance', href: '/finance' },
  { key: 'calendar', label: 'Calendar', href: '/calendar' },
  { key: 'tasks', label: 'Tasks', href: '/tasks' },
  { key: 'notes', label: 'Notes', href: '/notes' },
  { key: 'agencies', label: 'Agencies', href: '/event-management' },
] as const

export type SectionKey = (typeof SECTIONS)[number]['key']
/** 'edit' = see and change, 'view' = see only, 'none' = hidden. */
export type SectionLevel = 'edit' | 'view' | 'none'
export type SectionLevels = Record<SectionKey, SectionLevel>

const LEVELS: readonly SectionLevel[] = ['edit', 'view', 'none']

/** The levels a member has. Owners and admins always have full edit. A missing entry means full edit too. */
export function sectionLevelsFrom(raw: unknown, role: string): SectionLevels {
  const stored = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>).sections : undefined
  const sections = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {}
  const full = role === 'owner' || role === 'admin'
  return Object.fromEntries(
    SECTIONS.map(s => {
      const v = sections[s.key]
      const level = !full && typeof v === 'string' && (LEVELS as readonly string[]).includes(v) ? (v as SectionLevel) : 'edit'
      return [s.key, full ? 'edit' : level]
    })
  ) as SectionLevels
}

export function hiddenSectionsOf(levels: SectionLevels): SectionKey[] {
  return SECTIONS.filter(s => levels[s.key] === 'none').map(s => s.key)
}

/** Which section a page path belongs to, so navigation can hide it. Null for always-open pages. */
export function sectionForHref(href: string): SectionKey | null {
  const match = SECTIONS.find(s => href === s.href || href.startsWith(`${s.href}/`))
  return match ? match.key : null
}

export function sectionLabelOf(key: SectionKey): string {
  return SECTIONS.find(s => s.key === key)?.label ?? key
}
