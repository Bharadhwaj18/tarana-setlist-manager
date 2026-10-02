'use client'

import { useMemo } from 'react'
import { ListChecks } from 'lucide-react'
import { Avatar } from './AssigneePicker'
import { ProgressToggle } from './TaskCard'
import { cn } from '@/lib/utils'
import { formatDateDMY } from '@/lib/dates'
import { byPosition } from '@/lib/tasks'
import {
  PRIORITY_CHIP, PRIORITY_LABELS, PROGRESS_LABELS, labelStyle,
  type TaskBucket, type TaskLabel, type TaskPriority, type TaskProgress, type Task,
} from '@/types/tasks'

interface Props {
  buckets: TaskBucket[]
  tasks: Task[]
  labelsById: Record<string, TaskLabel>
  nameById: Record<string, string>
  today: string
  onOpenTask: (id: string) => void
}

const PROGRESS_CHIP: Record<TaskProgress, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-sky-100 text-sky-700',
  completed: 'bg-emerald-100 text-emerald-700',
}

export function TaskGrid({ buckets, tasks, labelsById, nameById, today, onOpenTask }: Props) {
  const rows = useMemo(() => {
    const order = new Map([...buckets].sort(byPosition).map((b, i) => [b.id, i]))
    return [...tasks].sort((a, b) => (order.get(a.bucket_id) ?? 0) - (order.get(b.bucket_id) ?? 0) || a.position - b.position)
  }, [buckets, tasks])
  const bucketName = useMemo(() => Object.fromEntries(buckets.map(b => [b.id, b.name])), [buckets])

  if (!rows.length) {
    return <p className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">No tasks on this board yet.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Task</th>
            <th className="px-3 py-2.5 font-semibold">Bucket</th>
            <th className="px-3 py-2.5 font-semibold">Progress</th>
            <th className="px-3 py-2.5 font-semibold">Priority</th>
            <th className="px-3 py-2.5 font-semibold">Assigned</th>
            <th className="px-3 py-2.5 font-semibold">Start</th>
            <th className="px-3 py-2.5 font-semibold">Due</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(t => {
            const done = t.progress === 'completed'
            const overdue = !done && !!t.due_date && t.due_date < today
            const priority = t.priority as TaskPriority
            const labels = t.label_ids.map(id => labelsById[id]).filter(Boolean)
            const doneItems = t.checklist.filter(c => c.done).length
            return (
              <tr key={t.id} onClick={() => onOpenTask(t.id)} className="cursor-pointer hover:bg-brand-50/60">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <ProgressToggle task={t} />
                    <div className="min-w-0">
                      <p className={cn('truncate font-medium', done ? 'text-gray-400 line-through' : 'text-gray-900')}>{t.title}</p>
                      {(labels.length > 0 || t.checklist.length > 0) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {labels.map(l => <span key={l.id} className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', labelStyle(l.color).chip)}>{l.name}</span>)}
                          {t.checklist.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-400"><ListChecks className="h-3 w-3" /> {doneItems}/{t.checklist.length}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">{bucketName[t.bucket_id]}</td>
                <td className="px-3 py-2.5">
                  <span className={cn('whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium', PROGRESS_CHIP[t.progress as TaskProgress])}>{PROGRESS_LABELS[t.progress as TaskProgress]}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={cn('whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium', PRIORITY_CHIP[priority])}>{PRIORITY_LABELS[priority]}</span>
                </td>
                <td className="px-3 py-2.5">
                  {t.assignee_ids.length ? (
                    <span className="flex -space-x-1.5">{t.assignee_ids.map(id => <Avatar key={id} name={nameById[id] ?? 'Member'} />)}</span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">{t.start_date ? formatDateDMY(t.start_date) : <span className="text-gray-300">—</span>}</td>
                <td className={cn('whitespace-nowrap px-3 py-2.5', overdue ? 'font-medium text-red-600' : 'text-gray-600')}>
                  {t.due_date ? formatDateDMY(t.due_date) : <span className="font-normal text-gray-300">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
