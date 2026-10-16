import { Repeat } from 'lucide-react'
import { RECURRENCE_LABELS, type TaskRecurrence } from '@/types/tasks'
import { cn } from '@/lib/utils'

const HOW: Record<TaskRecurrence, string> = {
  daily: 'Repeats every day. Ticking it off makes tomorrow’s copy.',
  weekly: 'Repeats every week. Ticking it off makes next week’s copy.',
  monthly: 'Repeats every month. Ticking it off makes next month’s copy.',
}

/** A small repeat symbol next to a task that repeats. Hover (or tap) it to see how often and what happens next. */
export function RepeatBadge({ recurrence, className }: { recurrence: string | null | undefined; className?: string }) {
  if (!recurrence || !(recurrence in RECURRENCE_LABELS)) return null
  const r = recurrence as TaskRecurrence
  return (
    <span data-tip={`${RECURRENCE_LABELS[r]} · ${HOW[r]}`} aria-label={`Repeats ${RECURRENCE_LABELS[r].toLowerCase()}`} role="img"
      className={cn('inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[11px] font-extrabold text-sky-800', className)}>
      <Repeat aria-hidden className="h-3 w-3" />{RECURRENCE_LABELS[r]}
    </span>
  )
}
