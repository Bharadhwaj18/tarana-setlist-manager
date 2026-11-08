import { ChevronRight } from 'lucide-react'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { EmptyState } from '@/components/ui/EmptyState'
import { OpenInWorkspace } from '@/components/layout/OpenInWorkspace'
import { MY_TASK_GROUPS, compareOpenTasks, myTaskGroup } from '@/lib/tasks'
import { PRIORITY_CHIP, PRIORITY_LABELS, type TaskPriority } from '@/types/tasks'
import { cn } from '@/lib/utils'
import type { PersonalTask } from '@/lib/data'

const shortDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

/** Your open tasks from every workspace, soonest first. Tap one to open it in its workspace. */
export function PersonalTasks({ tasks, currentId, today, weekAhead }: { tasks: PersonalTask[]; currentId: string; today: string; weekAhead: string }) {
  if (tasks.length === 0) return <EmptyState title="Nothing on your plate" description="Tasks assigned to you in any workspace show up here." />
  const sorted = [...tasks].sort((a, b) => compareOpenTasks({ due_date: a.dueDate, priority: a.priority }, { due_date: b.dueDate, priority: b.priority }))
  return (
    <div className="space-y-4">
      {MY_TASK_GROUPS.map(g => {
        const rows = sorted.filter(t => myTaskGroup(t.dueDate, today, weekAhead) === g.key)
        if (rows.length === 0) return null
        return (
          <section key={g.key} aria-label={g.label} className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
            <SectionLabel className={cn('mb-1', g.key === 'overdue' && '!text-red-700')}>{g.label} · {rows.length}</SectionLabel>
            <ul className="-mx-2 divide-y divide-brand-100">
              {rows.map(t => (
                <li key={t.id}>
                  <OpenInWorkspace workspaceId={t.workspaceId} currentId={currentId} href={`/tasks?task=${t.id}`} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-brand-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-gray-900">{t.title}</span>
                      <span className="block truncate text-xs text-gray-500">{t.workspaceName} · {t.boardName}{t.dueDate && ` · ${shortDate(t.dueDate)}`}</span>
                    </span>
                    {(t.priority === 'urgent' || t.priority === 'important') && (
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', PRIORITY_CHIP[t.priority as TaskPriority])}>{PRIORITY_LABELS[t.priority as TaskPriority]}</span>
                    )}
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
