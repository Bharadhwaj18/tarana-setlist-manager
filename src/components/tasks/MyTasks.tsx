'use client'

import Link from 'next/link'
import { CalendarDays, CheckCircle2 } from 'lucide-react'
import { ProgressToggle } from './TaskCard'
import { cn } from '@/lib/utils'
import { formatDateDMY } from '@/lib/dates'
import { MY_TASK_GROUPS, type MyTaskGroup } from '@/lib/tasks'
import { PRIORITY_CHIP, PRIORITY_LABELS, type TaskPriority } from '@/types/tasks'

export interface MyTaskItem {
  id: string
  boardId: string
  boardName: string
  title: string
  progress: string
  priority: string
  dueDate: string | null
  group: MyTaskGroup
}

function Row({ item, today }: { item: MyTaskItem; today: string }) {
  const done = item.progress === 'completed'
  const overdue = !done && !!item.dueDate && item.dueDate < today
  const priority = item.priority as TaskPriority
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <ProgressToggle task={{ id: item.id, progress: item.progress as never }} />
      <Link href={`/tasks/${item.boardId}?task=${item.id}`} className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', done ? 'text-gray-400 line-through' : 'text-gray-900')}>{item.title}</p>
        <p className="truncate text-xs text-gray-400">{item.boardName}</p>
      </Link>
      {priority !== 'medium' && !done && (
        <span className={cn('hidden rounded px-1.5 py-0.5 text-xs font-medium sm:inline', PRIORITY_CHIP[priority])}>{PRIORITY_LABELS[priority]}</span>
      )}
      {item.dueDate && (
        <span className={cn('inline-flex shrink-0 items-center gap-1 text-xs', overdue ? 'font-medium text-red-600' : 'text-gray-500')}>
          <CalendarDays className="h-3 w-3" /> {formatDateDMY(item.dueDate)}
        </span>
      )}
    </li>
  )
}

export function MyTasks({ open, completed, today }: { open: MyTaskItem[]; completed: MyTaskItem[]; today: string }) {
  if (!open.length && !completed.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
        <CheckCircle2 className="h-10 w-10 text-gray-300" />
        <p className="font-medium text-gray-500">Nothing assigned to you</p>
        <p className="text-sm text-gray-400">Tasks assigned to you on any board show up here</p>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      {MY_TASK_GROUPS.map(g => {
        const items = open.filter(i => i.group === g.key)
        if (!items.length) return null
        return (
          <section key={g.key}>
            <h2 className={cn('mb-2 text-xs font-semibold uppercase tracking-wider', g.key === 'overdue' ? 'text-red-600' : 'text-gray-500')}>
              {g.label} <span className="font-normal text-gray-400">· {items.length}</span>
            </h2>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {items.map(i => <Row key={i.id} item={i} today={today} />)}
            </ul>
          </section>
        )
      })}
      {!open.length && <p className="text-sm text-gray-500">All caught up.</p>}
      {completed.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Recently completed <span className="font-normal text-gray-400">· {completed.length}</span>
          </h2>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {completed.map(i => <Row key={i.id} item={i} today={today} />)}
          </ul>
        </section>
      )}
    </div>
  )
}
