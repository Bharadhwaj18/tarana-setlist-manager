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

export type NoteVisibility = 'private' | 'shared'

/** One-tap starting points for the things artists keep re-making. */
export interface NoteTemplate {
  id: string
  label: string
  title: string
  content?: string
  items?: string[]
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  { id: 'gig', label: 'Gig checklist', title: 'Gig day', items: ['Load-in time confirmed', 'Soundcheck', 'Instruments and cables', 'Merch', 'Setlist printed', 'Payment collected'] },
  { id: 'rehearsal', label: 'Rehearsal agenda', title: 'Rehearsal', items: ['Warm-up', 'Songs to polish', 'New song', 'Run the full set', 'Notes for next time'] },
  { id: 'release', label: 'Release plan', title: 'Release plan', items: ['Master approved', 'Cover art', 'Upload to distributor', 'Announce the date', 'Social posts scheduled', 'Press and playlists'] },
  { id: 'lyrics', label: 'Lyrics draft', title: 'Untitled lyrics', content: 'Verse 1\n\n\nChorus\n\n\nVerse 2\n\n' },
]
