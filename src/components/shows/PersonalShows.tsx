import { ChevronRight } from 'lucide-react'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { EmptyState } from '@/components/ui/EmptyState'
import { OpenInWorkspace } from '@/components/layout/OpenInWorkspace'
import type { PersonalShow } from '@/lib/data'

const PLAYED_SHOWN = 20
const shortDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'

/** Shows from every workspace: what's coming up first, then the latest that were played. Tap one to open it in its workspace. */
export function PersonalShows({ shows, currentId, today, basePath = '/shows', noun = 'shows', pastLabel = 'Played' }: { shows: PersonalShow[]; currentId: string; today: string; basePath?: string; noun?: string; pastLabel?: string }) {
  if (shows.length === 0) return <EmptyState title={`No ${noun} yet`} description={`${noun[0].toUpperCase()}${noun.slice(1)} from all your workspaces appear here.`} />
  const dated = (s: PersonalShow) => s.date ?? ''
  const upcoming = shows.filter(s => s.date && s.date >= today).sort((a, b) => dated(a).localeCompare(dated(b)))
  const played = shows.filter(s => !s.date || s.date < today).sort((a, b) => dated(b).localeCompare(dated(a)))
  const section = (label: string, rows: PersonalShow[], note?: string) => rows.length > 0 && (
    <section aria-label={label} className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
      <SectionLabel className="mb-1">{label} · {rows.length}</SectionLabel>
      <ul className="-mx-2 divide-y divide-brand-100">
        {rows.map(s => (
          <li key={s.id}>
            <OpenInWorkspace workspaceId={s.workspaceId} currentId={currentId} href={`${basePath}/${s.id}`} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-brand-50">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-gray-900">{s.title}</span>
                <span className="block truncate text-xs text-gray-500">{shortDate(s.date)}{s.venue && ` · ${s.venue}`} · {s.workspaceName}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
            </OpenInWorkspace>
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 text-xs text-gray-500">{note}</p>}
    </section>
  )
  return (
    <div className="space-y-4">
      {section('Coming up', upcoming)}
      {section(pastLabel, played.slice(0, PLAYED_SHOWN), played.length > PLAYED_SHOWN ? `Showing the latest ${PLAYED_SHOWN} of ${played.length}. Open a workspace to see the rest.` : undefined)}
    </div>
  )
}
