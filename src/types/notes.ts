import type { Database } from './database'

// Notes are plain Keep-style notes: title, body, colour, pin, archive, labels and a simple
// checklist. Anything with assignees, dates or progress lives on Tasks boards instead
// (see types/tasks.ts). The notes table still carries the old task columns, unused.
export type Note = Database['public']['Tables']['notes']['Row']
export type NoteInsert = Omit<Note, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>
export type NoteUpdate = Partial<NoteInsert>

export type ChecklistItem = Database['public']['Tables']['note_checklist_items']['Row']
export type ChecklistItemInsert = Omit<ChecklistItem, 'id' | 'created_at'>

export const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple'] as const
export type NoteColor = typeof NOTE_COLORS[number]

export const NOTE_COLOR_CLASSES: Record<NoteColor, string> = {
  yellow: 'bg-amber-50 border-amber-200',
  pink: 'bg-pink-50 border-pink-200',
  blue: 'bg-sky-50 border-sky-200',
  green: 'bg-emerald-50 border-emerald-200',
  purple: 'bg-violet-50 border-violet-200',
}
