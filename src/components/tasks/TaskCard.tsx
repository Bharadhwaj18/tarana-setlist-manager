'use client'

import { useTransition } from 'react'
import { CalendarDays, CheckCircle2, Circle, CircleDot, ListChecks, AlignLeft } from 'lucide-react'
import { setTaskProgress } from '@/actions/tasks'
import { useToast } from '@/components/ui/Toaster'
import { Avatar } from './AssigneePicker'
import { cn } from '@/lib/utils'
import { formatDateDMY } from '@/lib/dates'
import { PRIORITY_CHIP, PRIORITY_LABELS, labelStyle, type TaskLabel, type TaskPriority, type Task } from '@/types/tasks'

interface Props {
  task: Task
  labelsById: Record<string, TaskLabel>
  nameById: Record<string, string>
  today: string
  onOpen: () => void
}

export function ProgressToggle({ task }: { task: Pick<Task, 'id' | 'progress'> }) {
  const [isPending, startTransition] = useTransition()
  const toast = useToast()
  const done = task.progress === 'completed'
  const Icon = done ? CheckCircle2 : task.progress === 'in_progress' ? CircleDot : Circle

  return (
    <button
      type="button"
      disabled={isPending}
      onPointerDown={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
      onClick={e => {
        e.stopPropagation()
        startTransition(async () => {
          const result = await setTaskProgress(task.id, done ? 'not_started' : 'completed')
          if (result.error) toast(result.error, 'error')
        })
      }}
      className={cn('shrink-0 rounded-full transition-colors', done ? 'text-emerald-500 hover:text-emerald-600' : 'text-gray-300 hover:text-brand-500', task.progress === 'in_progress' && 'text-sky-500', isPending && 'opacity-50')}
      aria-label={done ? 'Mark as not started' : 'Mark as completed'}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  )
}

export function TaskCard({ task, labelsById, nameById, today, onOpen }: Props) {
  const done = task.progress === 'completed'
  const overdue = !done && !!task.due_date && task.due_date < today
  const labels = task.label_ids.map(id => labelsById[id]).filter(Boolean)
  const doneItems = task.checklist.filter(c => c.done).length
  const priority = task.priority as TaskPriority

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter') onOpen() }}
      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      {labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {labels.map(l => <span key={l.id} className={cn('h-2 w-8 rounded-full', labelStyle(l.color).dot)} title={l.name} />)}
        </div>
      )}
      <div className="flex items-start gap-2">
        <ProgressToggle task={task} />
        <p className={cn('min-w-0 flex-1 break-words text-sm font-medium', done ? 'text-gray-400 line-through' : 'text-gray-900')}>{task.title}</p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pl-[26px] text-xs text-gray-500">
        {priority !== 'medium' && (
          <span className={cn('rounded px-1.5 py-0.5 font-medium', PRIORITY_CHIP[priority])}>{PRIORITY_LABELS[priority]}</span>
        )}
        {task.due_date && (
          <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5', overdue ? 'bg-red-50 font-medium text-red-600' : 'bg-gray-50')}>
            <CalendarDays className="h-3 w-3" /> {formatDateDMY(task.due_date)}
          </span>
        )}
        {task.checklist.length > 0 && (
          <span className="inline-flex items-center gap-1"><ListChecks className="h-3 w-3" /> {doneItems}/{task.checklist.length}</span>
        )}
        {task.description && <AlignLeft className="h-3 w-3" aria-label="Has notes" />}
        {task.assignee_ids.length > 0 && (
          <span className="ml-auto flex -space-x-1.5">
            {task.assignee_ids.slice(0, 4).map(id => <Avatar key={id} name={nameById[id] ?? 'Member'} />)}
            {task.assignee_ids.length > 4 && (
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-500 ring-2 ring-white">+{task.assignee_ids.length - 4}</span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
