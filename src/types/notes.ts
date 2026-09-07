import type { Database } from './database'

export type Note = Database['public']['Tables']['notes']['Row']
export type NoteInsert = Omit<Note, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>
export type NoteUpdate = Partial<NoteInsert>
