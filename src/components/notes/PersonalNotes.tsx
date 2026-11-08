import { ChevronRight } from 'lucide-react'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { EmptyState } from '@/components/ui/EmptyState'
import { OpenInWorkspace } from '@/components/layout/OpenInWorkspace'
import { MY_TASK_GROUPS, myTaskGroup } from '@/lib/tasks'
import { cn } from '@/lib/utils'
import type { PersonalNote } from '@/lib/data'

const shortDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

/** Notes assigned to you in any workspace that aren't done yet, by due date. Tap one to open it in its workspace. */
export function PersonalNotes({ notes, currentId, today, weekAhead }: { notes: PersonalNote[]; currentId: string; today: string; weekAhead: string }) {
  if (notes.length === 0) return <EmptyState title="Nothing assigned to you" description="Notes assigned to you in any workspace show up here until they're done." />
  const sorted = [...notes].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
  return (
    <div className="space-y-4">
      {MY_TASK_GROUPS.map(g => {
        const rows = sorted.filter(n => myTaskGroup(n.dueDate, today, weekAhead) === g.key)
        if (rows.length === 0) return null
        return (
          <section key={g.key} aria-label={g.label} className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
            <SectionLabel className={cn('mb-1', g.key === 'overdue' && '!text-red-700')}>{g.label} · {rows.length}</SectionLabel>
            <ul className="-mx-2 divide-y divide-brand-100">
              {rows.map(n => (
                <li key={n.id}>
                  <OpenInWorkspace workspaceId={n.workspaceId} currentId={currentId} href={`/notes?open=${n.id}`} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-brand-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-gray-900">{n.title || 'Untitled note'}</span>
                      <span className="block truncate text-xs text-gray-500">{n.workspaceName}{n.dueDate && ` · ${shortDate(n.dueDate)}`}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                  </OpenInWorkspace>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
