'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendNotification } from '@/actions/notifications'
import { addDaysISO, addMonthsISO } from '@/lib/dates'
import type { Recurrence } from '@/types/notes'

export interface NoteFormData {
  title: string
  content: string
  assignedTo: string | null
  dueDate: string | null
  remindDaysBefore: number | null
  pinned: boolean
  color: string | null
  recurrence: string | null
  labels: string[]
  /** Plain text per item — id-less, since the whole set is replaced on every save (see upsertChecklistItems). */
  checklistItems: string[]
}

/** Replaces a note's whole checklist with the given items — simplest approach for a short, form-edited list; no per-item diffing needed. */
async function replaceChecklistItems(supabase: Awaited<ReturnType<typeof createClient>>, noteId: string, items: string[]) {
  await supabase.from('note_checklist_items').delete().eq('note_id', noteId)
  const trimmed = items.map(t => t.trim()).filter(Boolean)
  if (trimmed.length) {
    await supabase.from('note_checklist_items').insert(
      trimmed.map((text, position) => ({ note_id: noteId, text, position }))
    )
  }
}

/** Pings the assignee when a task is newly assigned to someone other than whoever's doing the assigning. */
async function notifyAssignment(supabase: Awaited<ReturnType<typeof createClient>>, actorId: string, assignedTo: string, title: string) {
  if (assignedTo === actorId) return
  const { data: actor } = await supabase.from('profiles').select('display_name').eq('id', actorId).maybeSingle()
  await sendNotification({
    recipientId: assignedTo,
    title: `${actor?.display_name ?? 'Someone'} assigned you a task`,
    body: title,
    link: '/notes',
    type: 'task_assigned',
  })
}

export async function createNote(data: NoteFormData): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: note, error } = await supabase.from('notes').insert({
    title: data.title.trim(),
    content: data.content.trim() || null,
    created_by: user.id,
    assigned_to: data.assignedTo,
    due_date: data.dueDate,
    remind_days_before: data.remindDaysBefore,
    pinned: data.pinned,
    color: data.color,
    recurrence: data.recurrence,
    labels: data.labels.length ? data.labels : null,
  }).select('id').single()
  if (error) return { error: error.message }

  await replaceChecklistItems(supabase, note.id, data.checklistItems)
  if (data.assignedTo) await notifyAssignment(supabase, user.id, data.assignedTo, data.title.trim())

  revalidatePath('/notes')
  revalidatePath('/calendar')
  return { id: note.id }
}

export async function updateNote(id: string, data: NoteFormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Only ping the assignee if the assignment actually changed on this save
  // — re-saving an already-assigned task shouldn't re-notify every time.
  const { data: existing } = await supabase.from('notes').select('assigned_to').eq('id', id).maybeSingle()

  const { error } = await supabase.from('notes').update({
    title: data.title.trim(),
    content: data.content.trim() || null,
    updated_by: user.id,
    assigned_to: data.assignedTo,
    due_date: data.dueDate,
    remind_days_before: data.remindDaysBefore,
    pinned: data.pinned,
    color: data.color,
    recurrence: data.recurrence,
    labels: data.labels.length ? data.labels : null,
  }).eq('id', id)
  if (error) return { error: error.message }

  await replaceChecklistItems(supabase, id, data.checklistItems)
  if (data.assignedTo && data.assignedTo !== existing?.assigned_to) {
    await notifyAssignment(supabase, user.id, data.assignedTo, data.title.trim())
  }

  revalidatePath('/notes')
  revalidatePath('/calendar')
  return {}
}

export async function deleteNote(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/notes')
  revalidatePath('/calendar')
  return {}
}

function nextDueDate(dueDate: string, recurrence: Recurrence) {
  if (recurrence === 'daily') return addDaysISO(dueDate, 1)
  if (recurrence === 'weekly') return addDaysISO(dueDate, 7)
  return addMonthsISO(dueDate, 1)
}

/**
 * Marks a task done/not-done. Completing a recurring task (recurrence set +
 * has a due date) also spins up the next occurrence — a fresh note with the
 * same title/assignee/labels/checklist (reset unchecked) and the due date
 * advanced by the recurrence interval — rather than pre-generating future
 * instances up front.
 */
export async function toggleNoteComplete(id: string, completed: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('notes')
    .update({ completed_at: completed ? new Date().toISOString() : null, updated_by: user.id })
    .eq('id', id)
  if (error) return { error: error.message }

  if (completed) {
    const { data: note } = await supabase.from('notes').select('*').eq('id', id).single()
    if (note?.recurrence && note.due_date) {
      const { data: nextNote, error: nextError } = await supabase.from('notes').insert({
        title: note.title,
        content: note.content,
        created_by: note.created_by,
        assigned_to: note.assigned_to,
        due_date: nextDueDate(note.due_date, note.recurrence as Recurrence),
        remind_days_before: note.remind_days_before,
        pinned: note.pinned,
        color: note.color,
        recurrence: note.recurrence,
        labels: note.labels,
      }).select('id').single()

      if (!nextError && nextNote) {
        const { data: items } = await supabase.from('note_checklist_items').select('text, position').eq('note_id', id).order('position')
        if (items?.length) {
          await supabase.from('note_checklist_items').insert(
            items.map(i => ({ note_id: nextNote.id, text: i.text, position: i.position, done: false }))
          )
        }
      }
    }
  }

  revalidatePath('/notes')
  revalidatePath('/calendar')
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
