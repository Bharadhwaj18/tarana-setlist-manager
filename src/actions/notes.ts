'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendNotification } from '@/actions/notifications'
import { addDaysISO, addMonthsISO, formatDateDMY } from '@/lib/dates'
import type { Recurrence } from '@/types/notes'

export interface ChecklistItemInput {
  /** Present = an existing item being edited; absent = a new item to insert. */
  id?: string
  text: string
  assignedTo: string | null
}

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
  checklistItems: ChecklistItemInput[]
}

/** Pings someone when a task/checklist item is newly assigned to them by someone else. */
async function notifyAssignment(supabase: Awaited<ReturnType<typeof createClient>>, actorId: string, assignedTo: string, title: string, body?: string) {
  if (assignedTo === actorId) return
  const { data: actor } = await supabase.from('profiles').select('display_name').eq('id', actorId).maybeSingle()
  await sendNotification({
    recipientId: assignedTo,
    title: `${actor?.display_name ?? 'Someone'} assigned you ${body ? 'a checkpoint' : 'a task'}`,
    body: body ?? title,
    link: '/notes',
    type: 'task_assigned',
  })
}

/**
 * Syncs a note's checklist against the submitted set — a real diff (update
 * existing rows by id, insert new ones, delete removed ones), NOT a
 * delete-everything-then-reinsert. That naive approach would silently reset
 * every item's `done` state on every single save, since a fresh row has no
 * memory of being checked. Also notifies anyone newly assigned to an item
 * (brand new with an assignee, or an existing item whose assignee changed).
 */
async function syncChecklistItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  noteId: string,
  items: ChecklistItemInput[],
  actorId: string,
  noteTitle: string
) {
  const { data: existingRows } = await supabase.from('note_checklist_items').select('id, assigned_to').eq('note_id', noteId)
  const existingById = new Map((existingRows ?? []).map(r => [r.id, r]))
  const submittedIds = new Set(items.filter(i => i.id).map(i => i.id!))

  const toDelete = (existingRows ?? []).filter(r => !submittedIds.has(r.id)).map(r => r.id)
  if (toDelete.length) await supabase.from('note_checklist_items').delete().in('id', toDelete)

  const toNotify: string[] = []
  const trimmed = items.map(i => ({ ...i, text: i.text.trim() })).filter(i => i.text)

  for (const [position, item] of trimmed.entries()) {
    if (item.id) {
      const existing = existingById.get(item.id)
      await supabase.from('note_checklist_items').update({ text: item.text, assigned_to: item.assignedTo, position }).eq('id', item.id)
      if (item.assignedTo && item.assignedTo !== existing?.assigned_to) toNotify.push(item.assignedTo)
    } else {
      await supabase.from('note_checklist_items').insert({ note_id: noteId, text: item.text, assigned_to: item.assignedTo, position })
      if (item.assignedTo) toNotify.push(item.assignedTo)
    }
  }

  for (const recipientId of new Set(toNotify)) {
    await notifyAssignment(supabase, actorId, recipientId, noteTitle, `"${trimmed.find(i => i.assignedTo === recipientId)?.text}" on "${noteTitle}"`)
  }
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

  await syncChecklistItems(supabase, note.id, data.checklistItems, user.id, data.title.trim())
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
  const { data: existing } = await supabase.from('notes').select('title, due_date, assigned_to').eq('id', id).maybeSingle()

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

  await syncChecklistItems(supabase, id, data.checklistItems, user.id, data.title.trim())

  const title = data.title.trim()
  const assigneeChanged = data.assignedTo && data.assignedTo !== existing?.assigned_to
  if (assigneeChanged) {
    await notifyAssignment(supabase, user.id, data.assignedTo!, title)
  } else if (
    data.assignedTo && data.assignedTo !== user.id && existing &&
    (existing.title !== title || existing.due_date !== data.dueDate)
  ) {
    // Same assignee as before, but something they'd care about changed —
    // a renamed task or a moved due date, not just a checklist tick.
    const { data: actor } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
    await sendNotification({
      recipientId: data.assignedTo,
      title: `${actor?.display_name ?? 'Someone'} updated "${title}"`,
      body: existing.due_date !== data.dueDate ? `Due date is now ${data.dueDate ? formatDateDMY(data.dueDate) : 'unset'}` : 'Details changed',
      link: '/notes',
      type: 'task_updated',
    })
  }

  revalidatePath('/notes')
  revalidatePath('/calendar')
  return {}
}

export async function deleteNote(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: note } = await supabase.from('notes').select('title, assigned_to').eq('id', id).maybeSingle()

  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) return { error: error.message }

  if (note?.assigned_to && user && note.assigned_to !== user.id) {
    const { data: actor } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
    await sendNotification({
      recipientId: note.assigned_to,
      title: `${actor?.display_name ?? 'Someone'} deleted "${note.title}"`,
      body: 'This task was removed.',
      link: '/notes',
      type: 'task_deleted',
    })
  }

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
 * same title/assignee/labels/checklist (reset unchecked, same per-item
 * assignees) and the due date advanced by the recurrence interval — rather
 * than pre-generating future instances up front.
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

    // Ping whoever created it — they're the one who'd want to know it's
    // handled, regardless of who it was assigned to.
    if (note && note.created_by !== user.id) {
      const { data: actor } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
      await sendNotification({
        recipientId: note.created_by,
        title: `${actor?.display_name ?? 'Someone'} completed "${note.title}"`,
        link: '/notes',
        type: 'task_completed',
      })
    }

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
        const { data: items } = await supabase.from('note_checklist_items').select('text, position, assigned_to').eq('note_id', id).order('position')
        if (items?.length) {
          await supabase.from('note_checklist_items').insert(
            items.map(i => ({ note_id: nextNote.id, text: i.text, position: i.position, assigned_to: i.assigned_to, done: false }))
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
