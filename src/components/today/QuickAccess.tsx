import Link from 'next/link'
import { sectionForHref, type SectionKey } from '@/lib/workspace-sections'
import { Building2, CalendarDays, CalendarRange, Ellipsis, ListMusic, Mic, Music2, SquareKanban, StickyNote, type LucideIcon } from 'lucide-react'
import { SectionLabel } from '@/components/ui/SectionLabel'

export interface QuickCounts {
  upcomingShows: number
  setlists: number | null
  songs: number | null
  recordings: number | null
  openTasks: number
  nextShowDate: string | null
}

interface Tile { href: string; label: string; icon: LucideIcon; hint?: string }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function nextLabel(date: string | null) {
  if (!date) return 'Nothing booked'
  return `Next: ${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'))}`
}

/** Everything the phone's bottom bar doesn't carry, one tap from the home screen. */
export function QuickAccess({ counts, variant, hiddenSections = [] }: { counts: QuickCounts; variant: 'desktop' | 'phone'; hiddenSections?: SectionKey[] }) {
  const visible = (t: Tile) => { const sec = sectionForHref(t.href); return !sec || !hiddenSections.includes(sec) }
  if (variant === 'phone') {
    const tiles: Tile[] = [
      { href: '/shows', label: 'Shows', icon: CalendarDays },
      { href: '/songs', label: 'Songs', icon: Music2 },
      { href: '/recordings', label: 'Recordings', icon: Mic },
      { href: '/tasks', label: 'Tasks', icon: SquareKanban },
      { href: '/notes', label: 'Notes', icon: StickyNote },
      { href: '/event-management', label: 'Agencies', icon: Building2 },
      { href: '/setlists', label: 'Setlists', icon: ListMusic },
      { href: '/more', label: 'More', icon: Ellipsis },
    ]
    return (
      <section className="space-y-2 lg:hidden">
        <SectionLabel>Jump to</SectionLabel>
        <div className="grid grid-cols-4 gap-2">
          {tiles.filter(visible).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex flex-col items-center gap-1.5 rounded-2xl border border-brand-200 bg-white px-1 pb-2.5 pt-3 text-center transition-colors hover:border-brand-300">
              <Icon className="h-[22px] w-[22px] text-brand-700" />
              <span className="text-[11px] font-extrabold text-gray-900">{label}</span>
            </Link>
          ))}
        </div>
      </section>
    )
  }

  const tiles: Tile[] = [
    { href: '/shows', label: 'Shows', icon: CalendarDays, hint: `${counts.upcomingShows} upcoming` },
    { href: '/setlists', label: 'Setlists', icon: ListMusic, hint: counts.setlists === null ? undefined : plural(counts.setlists, 'setlist') },
    { href: '/songs', label: 'Songs', icon: Music2, hint: counts.songs === null ? undefined : plural(counts.songs, 'song') },
    { href: '/recordings', label: 'Recordings', icon: Mic, hint: counts.recordings === null ? undefined : plural(counts.recordings, 'recording') },
    { href: '/tasks', label: 'Tasks', icon: SquareKanban, hint: `${counts.openTasks} open` },
    { href: '/notes', label: 'Notes', icon: StickyNote, hint: 'Jot things down' },
    { href: '/calendar', label: 'Calendar', icon: CalendarRange, hint: nextLabel(counts.nextShowDate) },
    { href: '/event-management', label: 'Agencies', icon: Building2, hint: 'Booking contacts' },
  ]
  return (
    <section className="hidden space-y-2 lg:block">
      <SectionLabel>Jump to</SectionLabel>
      <div className="grid grid-cols-4 gap-2.5">
        {tiles.filter(visible).map(({ href, label, icon: Icon, hint }) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-white p-3 transition-colors hover:border-brand-300">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-extrabold text-gray-900">{label}</span>
              {hint && <span className="block truncate text-xs text-gray-500">{hint}</span>}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
