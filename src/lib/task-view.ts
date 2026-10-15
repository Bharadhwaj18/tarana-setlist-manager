import { TASK_PRIORITIES, type Task, type TaskBoard } from '@/types/tasks'

/** How the Tasks list is filtered, sorted and grouped. Saved per device. */
export interface TaskViewState {
  sort: 'due' | 'priority' | 'status' | 'newest' | 'title'
  groupBy: 'status' | 'group' | 'person' | 'priority' | 'none'
  /** 'me' or member ids; empty = everyone. */
  who: string[]
  show: ('overdue' | 'week' | 'nodate' | 'hidedone')[]
  /** Board ids; empty = every group. */
  groups: string[]
  query: string
}

export const DEFAULT_VIEW: TaskViewState = { sort: 'due', groupBy: 'status', who: [], show: [], groups: [], query: '' }

export const SORT_LABELS: Record<TaskViewState['sort'], string> = { due: 'Due date', priority: 'Priority', status: 'Status', newest: 'Newest', title: 'A to Z' }
export const GROUP_BY_LABELS: Record<TaskViewState['groupBy'], string> = { status: 'Status', group: 'Group', person: 'Person', priority: 'Priority', none: 'None' }
export const SHOW_LABELS: Record<TaskViewState['show'][number], string> = { overdue: 'Overdue', week: 'Due this week', nodate: 'No date', hidedone: 'Hide done' }

export const STATUS_ORDER = ['in_progress', 'not_started', 'completed'] as const
export const STATUS_TEXT: Record<string, string> = { not_started: 'Not started', in_progress: 'In progress', completed: 'Done' }

/** How many filters are on, for the count on the Filter button. */
export function activeFilterCount(v: TaskViewState) {
  return v.who.length + v.show.length + v.groups.length
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function filterTasks(tasks: Task[], v: TaskViewState, ctx: { today: string; userId?: string; boardIds: Set<string> }) {
  const q = v.query.trim().toLowerCase()
  const weekEnd = addDays(ctx.today, 7)
  const who = v.who.map(w => (w === 'me' ? ctx.userId ?? '' : w))
  return tasks.filter(t => {
    if (!ctx.boardIds.has(t.board_id)) return false
    const done = t.progress === 'completed'
    if (v.show.includes('hidedone') && done) return false
    if (v.show.includes('overdue') && !(!done && t.due_date && t.due_date < ctx.today)) return false
    if (v.show.includes('week') && !(t.due_date && t.due_date >= ctx.today && t.due_date <= weekEnd)) return false
    if (v.show.includes('nodate') && t.due_date) return false
    if (who.length && !t.assignee_ids.some(a => who.includes(a))) return false
    if (v.groups.length && !v.groups.includes(t.board_id)) return false
    if (q && !t.title.toLowerCase().includes(q)) return false
    return true
  })
}

const priorityRank = (p: string) => { const i = (TASK_PRIORITIES as readonly string[]).indexOf(p); return i < 0 ? 99 : i }
const statusRank = (s: string) => { const i = (STATUS_ORDER as readonly string[]).indexOf(s); return i < 0 ? 99 : i }

export function sortTasks(tasks: Task[], sort: TaskViewState['sort']) {
  const byDue = (a: Task, b: Task) => (a.due_date ?? '9999') .localeCompare(b.due_date ?? '9999')
  const cmp: Record<TaskViewState['sort'], (a: Task, b: Task) => number> = {
    due: (a, b) => byDue(a, b) || priorityRank(a.priority) - priorityRank(b.priority),
    priority: (a, b) => priorityRank(a.priority) - priorityRank(b.priority) || byDue(a, b),
    status: (a, b) => statusRank(a.progress) - statusRank(b.progress) || byDue(a, b),
    newest: (a, b) => b.created_at.localeCompare(a.created_at),
    title: (a, b) => a.title.localeCompare(b.title),
  }
  return [...tasks].sort(cmp[sort])
}

export interface TaskSection { key: string; label: string; tasks: Task[]; collapsedByDefault?: boolean }

export function groupTasks(tasks: Task[], v: TaskViewState, ctx: { boards: TaskBoard[]; nameById: Record<string, string> }): TaskSection[] {
  const sorted = sortTasks(tasks, v.sort)
  if (v.groupBy === 'none') return [{ key: 'all', label: 'All tasks', tasks: sorted }]
  if (v.groupBy === 'status') {
    return STATUS_ORDER.map(s => ({ key: s, label: STATUS_TEXT[s], tasks: sorted.filter(t => t.progress === s), collapsedByDefault: s === 'completed' }))
  }
  if (v.groupBy === 'group') {
    return ctx.boards.map(b => ({ key: b.id, label: b.name, tasks: sorted.filter(t => t.board_id === b.id) }))
  }
  if (v.groupBy === 'priority') {
    return TASK_PRIORITIES.map(p => ({ key: p, label: p[0].toUpperCase() + p.slice(1), tasks: sorted.filter(t => t.priority === p) }))
  }
  // Person: by first person on the task; nobody yet goes last.
  const keys = [...new Set(sorted.map(t => t.assignee_ids[0] ?? ''))]
  keys.sort((a, b) => (a ? (ctx.nameById[a] ?? 'Member') : '￿').localeCompare(b ? (ctx.nameById[b] ?? 'Member') : '￿'))
  return keys.map(k => ({ key: k || 'nobody', label: k ? (ctx.nameById[k] ?? 'Member') : 'Nobody yet', tasks: sorted.filter(t => (t.assignee_ids[0] ?? '') === k) }))
}
