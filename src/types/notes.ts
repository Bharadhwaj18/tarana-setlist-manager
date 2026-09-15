import type { Database } from './database'

// Notes and Tasks share one entity, one section — a "task" is just a note
// with assigned_to/due_date set, not a parallel feature (confirmed with
// Shreyas). A plain note is a row where all the task-ish fields are null.
export type Note = Database['public']['Tables']['notes']['Row']
export type NoteInsert = Omit<Note, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>
export type NoteUpdate = Partial<NoteInsert>

export type ChecklistItem = Database['public']['Tables']['note_checklist_items']['Row']
export type ChecklistItemInsert = Omit<ChecklistItem, 'id' | 'created_at'>

// Free-text-but-app-controlled palette, same convention as SHOW_FORMATS —
// a small fixed set of background colors a note/task can be tagged with,
// Google Keep style.
export const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple'] as const
export type NoteColor = typeof NOTE_COLORS[number]

export const NOTE_COLOR_CLASSES: Record<NoteColor, string> = {
  yellow: 'bg-amber-50 border-amber-200',
  pink: 'bg-pink-50 border-pink-200',
  blue: 'bg-sky-50 border-sky-200',
  green: 'bg-emerald-50 border-emerald-200',
  purple: 'bg-violet-50 border-violet-200',
}

// Basic recurrence — regenerates the next occurrence on completion rather
// than pre-generating future instances or supporting a full RRULE.
export const RECURRENCE_OPTIONS = ['daily', 'weekly', 'monthly'] as const
export type Recurrence = typeof RECURRENCE_OPTIONS[number]

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

// Preset reminder lead times shown in the UI — remind_days_before also
// accepts any other non-negative integer, these are just the quick picks.
export const REMINDER_PRESETS = [
  { value: 0, label: 'On the day' },
  { value: 1, label: '1 day before' },
  { value: 3, label: '3 days before' },
  { value: 7, label: '1 week before' },
] as const
