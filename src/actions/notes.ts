'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspaceId } from '@/lib/workspace'

export interface ChecklistItemInput {
  /** Present = an existing item being edited; absent = a new item to insert. */
  id?: string
  text: string
  done: boolean
}

export interface NoteFormData {
  title: string
  content: string
  pinned: boolean
  color: string | null
  labels: string[]
  checklistItems: ChecklistItemInput[]
}

/**
 * Syncs a note's checklist against the submitted set — a real diff (update
 * existing rows by id, insert new ones, delete removed ones), not a
 * delete-and-reinsert, so ids stay stable.
 */
async function syncChecklistItems(supabase: Awaited<ReturnType<typeof createClient>>, noteId: string, items: ChecklistItemInput[]) {
  const { data: existingRows } = await supabase.from('note_checklist_items').select('id').eq('note_id', noteId)
  const submittedIds = new Set(items.filter(i => i.id).map(i => i.id!))

  const toDelete = (existingRows ?? []).filter(r => !submittedIds.has(r.id)).map(r => r.id)
  if (toDelete.length) await supabase.from('note_checklist_items').delete().in('id', toDelete)

  const trimmed = items.map(i => ({ ...i, text: i.text.trim() })).filter(i => i.text)
  for (const [position, item] of trimmed.entries()) {
    if (item.id) {
      await supabase.from('note_checklist_items').update({ text: item.text, done: item.done, position }).eq('id', item.id)
    } else {
      await supabase.from('note_checklist_items').insert({ note_id: noteId, text: item.text, done: item.done, position })
    }
  }
}

function hasContent(data: NoteFormData) {
  return !!data.title.trim() || !!data.content.trim() || data.checklistItems.some(i => i.text.trim())
}

export async function createNote(data: NoteFormData): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!hasContent(data)) return { error: 'Add a title, some text or a checklist item' }

  const { data: note, error } = await supabase.from('notes').insert({
    title: data.title.trim(),
    content: data.content.trim() || null,
    created_by: user.id,
    workspace_id: await requireWorkspaceId(),
    pinned: data.pinned,
    color: data.color,
    labels: data.labels.length ? data.labels : null,
  }).select('id').single()
  if (error) return { error: error.message }

  await syncChecklistItems(supabase, note.id, data.checklistItems)

  revalidatePath('/notes')
  return { id: note.id }
}

export async function updateNote(id: string, data: NoteFormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!hasContent(data)) return { error: 'Add a title, some text or a checklist item' }

  const { error } = await supabase.from('notes').update({
    title: data.title.trim(),
    content: data.content.trim() || null,
    updated_by: user.id,
    pinned: data.pinned,
    color: data.color,
    labels: data.labels.length ? data.labels : null,
  }).eq('id', id)
  if (error) return { error: error.message }

  await syncChecklistItems(supabase, id, data.checklistItems)

  revalidatePath('/notes')
  return {}
}

export async function deleteNote(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/notes')
  return {}
}

export async function toggleChecklistItem(itemId: string, done: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('note_checklist_items').update({ done }).eq('id', itemId)
  if (error) return { error: error.message }
  revalidatePath('/notes')
  return {}
}

export async function togglePin(id: string, pinned: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('notes').update({ pinned }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/notes')
  return {}
}

export async function toggleArchive(id: string, archived: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('notes').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/notes')
  return {}
}
