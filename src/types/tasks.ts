import type { Database, TaskBoardLabel, TaskChecklistEntry } from './database'

type Tables = Database['public']['Tables']

export type TaskBoard = Tables['task_boards']['Row']
export type TaskBucket = Tables['task_buckets']['Row']
export type Task = Tables['tasks']['Row']
export type TaskField = Tables['task_fields']['Row']
/** A label as stored in task_boards.labels. A task points at it by id (tasks.label_ids). */
export type TaskLabel = TaskBoardLabel
/** One checklist row as stored in tasks.checklist. */
export type TaskChecklistItem = TaskChecklistEntry

/** Everything the Tasks pages need for one workspace, fetched once. */
export interface TaskData {
  boards: TaskBoard[]
  buckets: TaskBucket[]
  tasks: Task[]
  /** The workspace's own columns, in order. */
  fields: TaskField[]
}

export const TASK_FIELD_TYPES = ['checkbox', 'select', 'text', 'number', 'date', 'person'] as const
export type TaskFieldType = (typeof TASK_FIELD_TYPES)[number]

export const TASK_FIELD_TYPE_LABELS: Record<TaskFieldType, { label: string; hint: string }> = {
  checkbox: { label: 'Tick box', hint: 'Yes or no' },
  select: { label: 'Dropdown', hint: 'Pick one option' },
  text: { label: 'Text', hint: 'A short note' },
  number: { label: 'Number', hint: 'Amounts, counts' },
  date: { label: 'Date', hint: 'Any date' },
  person: { label: 'Person', hint: 'Someone in the workspace' },
}

/** A custom field's options (dropdowns only), read safely from the stored JSON. */
export function fieldOptions(field: Pick<TaskField, 'options'>): string[] {
  return Array.isArray(field.options) ? field.options.filter((o): o is string => typeof o === 'string') : []
}

/** A task's value for one custom field, read safely from the stored JSON. */
export function customValue(task: Pick<Task, 'custom'>, fieldId: string): string | number | boolean | null {
  const c = task.custom
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null
  const v = (c as Record<string, unknown>)[fieldId]
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : null
}

export const TASK_PROGRESS = ['not_started', 'in_progress', 'completed'] as const
export type TaskProgress = (typeof TASK_PROGRESS)[number]

export const PROGRESS_LABELS: Record<TaskProgress, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
}

export const TASK_PRIORITIES = ['urgent', 'important', 'medium', 'low'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: 'Urgent',
  important: 'Important',
  medium: 'Medium',
  low: 'Low',
}

export const PRIORITY_CHIP: Record<TaskPriority, string> = {
  urgent: 'bg-red-100 text-red-700',
  important: 'bg-orange-100 text-orange-700',
  medium: 'bg-sky-100 text-sky-700',
  low: 'bg-gray-100 text-gray-500',
}

export const TASK_RECURRENCE = ['daily', 'weekly', 'monthly'] as const
export type TaskRecurrence = (typeof TASK_RECURRENCE)[number]

export const RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

// Quick picks for remind_days_before; any non-negative integer is also accepted.
export const REMINDER_PRESETS = [
  { value: 0, label: 'On the day' },
  { value: 1, label: '1 day before' },
  { value: 3, label: '3 days before' },
  { value: 7, label: '1 week before' },
] as const

// Free-text-but-app-controlled palette for board labels (same convention as NOTE_COLORS).
export const LABEL_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'gray'] as const
export type LabelColor = (typeof LABEL_COLORS)[number]

export const LABEL_STYLES: Record<LabelColor, { dot: string; chip: string }> = {
  red: { dot: 'bg-red-500', chip: 'bg-red-100 text-red-700' },
  orange: { dot: 'bg-orange-500', chip: 'bg-orange-100 text-orange-700' },
  yellow: { dot: 'bg-amber-400', chip: 'bg-amber-100 text-amber-800' },
  green: { dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700' },
  teal: { dot: 'bg-teal-500', chip: 'bg-teal-100 text-teal-700' },
  blue: { dot: 'bg-sky-500', chip: 'bg-sky-100 text-sky-700' },
  purple: { dot: 'bg-violet-500', chip: 'bg-violet-100 text-violet-700' },
  pink: { dot: 'bg-pink-500', chip: 'bg-pink-100 text-pink-700' },
  gray: { dot: 'bg-gray-400', chip: 'bg-gray-100 text-gray-600' },
}

export function labelStyle(color: string) {
  return LABEL_STYLES[(LABEL_COLORS as readonly string[]).includes(color) ? (color as LabelColor) : 'gray']
}

export const DEFAULT_BUCKETS = ['To do', 'In progress', 'Done'] as const

export interface Member { id: string; name: string }

/** A dated task as the Calendar sees it. */
export type CalendarTask = Task
