import type { Task, TaskBucket } from '@/types/tasks'

export function byPosition<T extends { position: number }>(a: T, b: T) {
  return a.position - b.position
}

/** Task ids of one bucket, in display order. */
export function bucketTaskIds(tasks: Pick<Task, 'id' | 'bucket_id' | 'position'>[], bucketId: string): string[] {
  return tasks.filter(t => t.bucket_id === bucketId).sort(byPosition).map(t => t.id)
}

/**
 * A position that sorts between two neighbours (either may be missing). Positions are
 * floats, so a drop only ever rewrites the one task that moved.
 */
export function positionBetween(prev: number | undefined, next: number | undefined): number {
  if (prev === undefined && next === undefined) return 1
  if (prev === undefined) return next! - 1
  if (next === undefined) return prev + 1
  return (prev + next) / 2
}

export function nextBucketPosition(buckets: Pick<TaskBucket, 'position'>[]): number {
  return buckets.reduce((max, b) => Math.max(max, b.position), 0) + 1
}

export type MyTaskGroup = 'overdue' | 'today' | 'upcoming' | 'later' | 'no_date'

export const MY_TASK_GROUPS: { key: MyTaskGroup; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Due today' },
  { key: 'upcoming', label: 'Next 7 days' },
  { key: 'later', label: 'Later' },
  { key: 'no_date', label: 'No due date' },
]

/** Which "My tasks" section an open task belongs in, by due date relative to `today` (YYYY-MM-DD). */
export function myTaskGroup(dueDate: string | null, today: string, weekAhead: string): MyTaskGroup {
  if (!dueDate) return 'no_date'
  if (dueDate < today) return 'overdue'
  if (dueDate === today) return 'today'
  if (dueDate <= weekAhead) return 'upcoming'
  return 'later'
}

/** Open tasks sort by due date (undated last), then priority; ties keep their order. */
const PRIORITY_RANK: Record<string, number> = { urgent: 0, important: 1, medium: 2, low: 3 }
export function compareOpenTasks(a: Pick<Task, 'due_date' | 'priority'>, b: Pick<Task, 'due_date' | 'priority'>) {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date < b.due_date ? -1 : 1
  }
  return (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2)
}

/** Picker members (own name suffixed "(you)") and a plain id → real-name lookup for avatars and lists. */
export function buildPeople(profiles: { id: string; display_name: string | null }[], currentUserId: string | undefined) {
  const nameById: Record<string, string> = {}
  const members = profiles.map(p => {
    const name = p.display_name?.trim() || 'Member'
    nameById[p.id] = name
    return { id: p.id, name: p.id === currentUserId ? `${name} (you)` : name }
  })
  return { members, nameById }
}
