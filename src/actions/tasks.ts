'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspaceId } from '@/lib/workspace'
import { sendNotification } from '@/actions/notifications'
import { addDaysISO, addMonthsISO, daysUntil, formatDateDMY } from '@/lib/dates'
import { boardNameSchema, labelInputSchema, taskInputSchema, type TaskInput } from '@/lib/validators'
import { DEFAULT_BUCKETS, TASK_PROGRESS, type TaskLabel, type TaskProgress, type TaskRecurrence } from '@/types/tasks'

type Supabase = Awaited<ReturnType<typeof createClient>>
type Result = { error?: string }

const MAX_LABELS_PER_BOARD = 50

function refresh() {
  revalidatePath('/tasks', 'layout')
  revalidatePath('/calendar')
}

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

async function actorName(supabase: Supabase, userId: string) {
  const { data } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle()
  return data?.display_name ?? 'Someone'
}

const taskLink = (boardId: string, taskId: string) => `/tasks/${boardId}?task=${taskId}`

async function notifyAssigned(supabase: Supabase, actorId: string, userIds: string[], task: { id: string; board_id: string; title: string }) {
  const recipients = userIds.filter(id => id !== actorId)
  if (!recipients.length) return
  const name = await actorName(supabase, actorId)
  await Promise.all(recipients.map(recipientId => sendNotification({
    recipientId,
    title: `${name} assigned you a task`,
    body: task.title,
    link: taskLink(task.board_id, task.id),
    type: 'task_assigned',
  })))
}

async function nextPosition(supabase: Supabase, bucketId: string) {
  const { data } = await supabase.from('tasks').select('position').eq('bucket_id', bucketId).order('position', { ascending: false }).limit(1)
  return (data?.[0]?.position ?? 0) + 1
}

// ---- Boards -------------------------------------------------------------------------

export async function createBoard(name: string): Promise<Result & { id?: string }> {
  const parsed = boardNameSchema.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { supabase, user } = await getActor()
  if (!user) return { error: 'Not authenticated' }

  const { data: board, error } = await supabase
    .from('task_boards')
    .insert({ name: parsed.data, created_by: user.id, workspace_id: await requireWorkspaceId() })
    .select('id')
    .single()
  if (error) return { error: error.message }

  const { error: bucketError } = await supabase
    .from('task_buckets')
    .insert(DEFAULT_BUCKETS.map((bucketName, i) => ({ board_id: board.id, name: bucketName, position: i + 1 })))
  if (bucketError) {
    await supabase.from('task_boards').delete().eq('id', board.id)
    return { error: bucketError.message }
  }

  refresh()
  return { id: board.id }
}

export async function renameBoard(id: string, name: string): Promise<Result> {
  const parsed = boardNameSchema.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { supabase, user } = await getActor()
  if (!user) return { error: 'Not authenticated' }
  const { error } = await supabase.from('task_boards').update({ name: parsed.data }).eq('id', id)
  if (error) return { error: error.message }
  refresh()
  return {}
}

export async function deleteBoard(id: string): Promise<Result> {
  const { supabase, user } = await getActor()
  if (!user) return { error: 'Not authenticated' }
  const { error } = await supabase.from('task_boards').delete().eq('id', id)
  if (error) return { error: error.message }
  refresh()
  return {}
}

// ---- Buckets ------------------------------------------------------------------------

export async function createBucket(boardId: string, name: string): Promise<Result> {
  const parsed = boardNameSchema.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { supabase, user } = await getActor()
  if (!user) return { error: 'Not authenticated' }

  const { data: last } = await supabase.from('task_buckets').select('position').eq('board_id', boardId).order('position', { ascending: false }).limit(1)
  const { error } = await supabase.from('task_buckets').insert({ board_id: boardId, name: parsed.data, position: (last?.[0]?.position ?? 0) + 1 })
  if (error) return { error: error.message }
  refresh()
  return {}
}

export async function renameBucket(id: string, name: string): Promise<Result> {
  const parsed = boardNameSchema.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { supabase, user } = await getActor()
  if (!user) return { error: 'Not authenticated' }
  const { error } = await supabase.from('task_buckets').update({ name: parsed.data }).eq('id', id)
  if (error) return { error: error.message }
  refresh()
  return {}
}

/** Deletes a bucket AND every task in it. A board always keeps at least one bucket. */
export async function deleteBucket(id: string): Promise<Result> {
  const { supabase, user } = await getActor()
  if (!user) return { error: 'Not authenticated' }

  const { data: bucket } = await supabase.from('task_buckets').select('board_id').eq('id', id).maybeSingle()
  if (!bucket) return { error: 'Bucket not found' }
  const { count } = await supabase.from('task_buckets').select('id', { count: 'exact', head: true }).eq('board_id', bucket.board_id)
  if ((count ?? 0) <= 1) return { error: 'A board needs at least one bucket' }

  const { error } = await supabase.from('task_buckets').delete().eq('id', id)
  if (error) return { error: error.message }
  refresh()
  return {}
}

/** Swaps a bucket with its neighbour, so buckets can be reordered without dragging. */
export async function moveBucket(id: string, direction: 'left' | 'right'): Promise<Result> {
  const { supabase, user } = await getActor()
  if (!user) return { error: 'Not authenticated' }

  const { data: bucket } = await supabase.from('task_buckets').select('id, board_id, position').eq('id', id).maybeSingle()
  if (!bucket) return { error: 'Bucket not found' }
  const { data: siblings } = await supabase.from('task_buckets').select('id, position').eq('board_id', bucket.board_id).order('position')
  const list = siblings ?? []
  const index = list.findIndex(b => b.id === id)
  const other = list[direction === 'left' ? index - 1 : index + 1]
  if (!other) return {}

  const [a, b] = await Promise.all([
    supabase.from('task_buckets').update({ position: other.position }).eq('id', bucket.id),
    supabase.from('task_buckets').update({ position: bucket.position }).eq('id', other.id),
  ])
  const error = a.error ?? b.error
  if (error) return { error: error.message }
  refresh()
  return {}
}

// ---- Labels -------------------------------------------------------------------------
// A board's labels live in task_boards.labels (jsonb); a task points at them by id in label_ids.

async function readBoardLabels(supabase: Supabase, boardId: string): Promise<TaskLabel[] | null> {
  const { data } = await supabase.from('task_boards').select('labels').eq('id', boardId).maybeSingle()
  return data ? data.labels : null
}

async function writeBoardLabels(supabase: Supabase, boardId: string, labels: TaskLabel[]): Promise<Result> {
  const { error } = await supabase.from('task_boards').update({ labels }).eq('id', boardId)
  return error ? { error: error.message } : {}
}

export async function createLabel(boardId: string, input: { name: string; color: string }): Promise<Result & { id?: string }> {
  const parsed = labelInputSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { supabase, user } = await getActor()
  if (!user) return { error: 'Not authenticated' }

  const labels = await readBoardLabels(supabase, boardId)
  if (!labels) return { error: 'Board not found' }
  if (labels.length >= MAX_LABELS_PER_BOARD) return { error: `A board can have up to ${MAX_LABELS_PER_BOARD} labels` }

  const id = crypto.randomUUID()
  const result = await writeBoardLabels(supabase, boardId, [...labels, { id, ...parsed.data }])
  if (result.error) return result
  refresh()
  return { id }
}

export async function updateLabel(boardId: string, id: string, input: { name: string; color: string }): Promise<Result> {
  const parsed = labelInputSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { supabase, user } = await getActor()
  if (!user) return { error: 'Not authenticated' }

  const labels = await readBoardLabels(supabase, boardId)
  if (!labels) return { error: 'Board not found' }
  const result = await writeBoardLabels(supabase, boardId, labels.map(l => (l.id === id ? { id, ...parsed.data } : l)))
  if (result.error) return result
  refresh()
  return {}
}

/** Removes the label from the board and from every task that carried it. */
export async function deleteLabel(boardId: string, id: string): Promise<Result> {
  const { supabase, user } = await getActor()
  if (!user) return { error: 'Not authenticated' }

  const labels = await readBoardLabels(supabase, boardId)
  if (!labels) return { error: 'Board not found' }
  const result = await writeBoardLabels(supabase, boardId, labels.filter(l => l.id !== id))
  if (result.error) return result

  const { data: tagged } = await supabase.from('tasks').select('id, label_ids').eq('board_id', boardId).contains('label_ids', [id])
  await Promise.all((tagged ?? []).map(t => supabase.from('tasks').update({ label_ids: t.label_ids.filter(l => l !== id) }).eq('id', t.id)))

  refresh()
  return {}
}

// ---- Tasks --------------------------------------------------------------------------

/** Quick-add: a title, plus optionally a bucket (defaults to the board's first), due date and assignees. */
export async function createTask(input: {
  boardId: string
  bucketId?: string
  title: string
  dueDate?: string | null
  assigneeIds?: string[]
}): Promise<Result & { id?: string }> {
  const title = input.title.trim()
  if (!title) return { error: 'Title is required' }
  if (title.length > 300) return { error: 'Keep the title under 300 characters' }
  const { supabase, user } = await getActor()
  if (!user) return { error: 'Not authenticated' }

  let bucketId = input.bucketId
  if (!bucketId) {
    const { data: first } = await supabase.from('task_buckets').select('id').eq('board_id', input.boardId).order('position').limit(1)
    bucketId = first?.[0]?.id
    if (!bucketId) return { error: 'This board has no buckets' }
  }

  const assigneeIds = [...new Set(input.assigneeIds ?? [])]
  const { data: task, error } = await supabase.from('tasks').insert({
    board_id: input.boardId,
    bucket_id: bucketId,
    title,
    due_date: input.dueDate ?? null,
    assignee_ids: assigneeIds,
    position: await nextPosition(supabase, bucketId),
    created_by: user.id,
  }).select('id, board_id, title').single()
  if (error) return { error: error.message }

  await notifyAssigned(supabase, user.id, assigneeIds, task)

  refresh()
  return { id: task.id }
}

function nextDueDate(dueDate: string, recurrence: TaskRecurrence) {
  if (recurrence === 'daily') return addDaysISO(dueDate, 1)
  if (recurrence === 'weekly') return addDaysISO(dueDate, 7)
  return addMonthsISO(dueDate, 1)
}

/**
 * Side effects of a task becoming completed: tells whoever created it (if someone else
 * finished it) and, for a repeating task with a due date, spins up the next occurrence in
 * the board's first bucket — same assignees, labels and checklist (unticked), due date
 * moved forward — rather than pre-generating future copies.
 */
async function onTaskCompleted(supabase: Supabase, actorId: string, taskId: string) {
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle()
  if (!task) return

  if (task.created_by !== actorId) {
    const name = await actorName(supabase, actorId)
    await sendNotification({
      recipientId: task.created_by,
      title: `${name} completed "${task.title}"`,
      link: taskLink(task.board_id, task.id),
      type: 'task_completed',
    })
  }

  if (!task.recurrence || !task.due_date) return

  const { data: first } = await supabase.from('task_buckets').select('id').eq('board_id', task.board_id).order('position').limit(1)
  const bucketId = first?.[0]?.id
  if (!bucketId) return

  const dueDate = nextDueDate(task.due_date, task.recurrence as TaskRecurrence)
  const startDate = task.start_date ? addDaysISO(dueDate, -daysUntil(task.due_date, task.start_date)) : null
  await supabase.from('tasks').insert({
    board_id: task.board_id,
    bucket_id: bucketId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    start_date: startDate,
    due_date: dueDate,
    remind_days_before: task.remind_days_before,
    recurrence: task.recurrence,
    assignee_ids: task.assignee_ids,
    label_ids: task.label_ids,
    checklist: task.checklist.map(c => ({ id: crypto.randomUUID(), text: c.text, done: false })),
    position: await nextPosition(supabase, bucketId),
    created_by: task.created_by,
  })
}

export async function updateTask(id: string, input: TaskInput): Promise<Result> {
  const parsed = taskInputSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const data = parsed.data
  const { supabase, user } = await getActor()
  if (!user) return { error: 'Not authenticated' }

  const { data: existing } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle()
  if (!existing) return { error: 'Task not found' }

  // Only labels that still exist on this board; anything stale is dropped quietly.
  const boardLabels = new Set((await readBoardLabels(supabase, existing.board_id) ?? []).map(l => l.id))
  const assigneeIds = [...new Set(data.assigneeIds)]
  const added = assigneeIds.filter(a => !existing.assignee_ids.includes(a))

  const completing = data.progress === 'completed' && existing.progress !== 'completed'
  const patch = {
    title: data.title,
    description: data.description?.trim() ? data.description : null,
    bucket_id: data.bucketId,
    progress: data.progress,
    priority: data.priority,
    start_date: data.startDate,
    due_date: data.dueDate,
    remind_days_before: data.dueDate ? data.remindDaysBefore : null,
    recurrence: data.dueDate ? data.recurrence : null,
    assignee_ids: assigneeIds,
    label_ids: [...new Set(data.labelIds)].filter(l => boardLabels.has(l)),
    checklist: data.checklist.map(c => ({ id: c.id ?? crypto.randomUUID(), text: c.text, done: c.done })),
    completed_at: data.progress === 'completed' ? (existing.completed_at ?? new Date().toISOString()) : null,
    updated_by: user.id,
    ...(data.bucketId !== existing.bucket_id ? { position: await nextPosition(supabase, data.bucketId) } : {}),
  }
  const { error } = await supabase.from('tasks').update(patch).eq('id', id)
  if (error) return { error: error.message }

  await notifyAssigned(supabase, user.id, added, { id, board_id: existing.board_id, title: data.title })

  // People who were already on it only hear about changes that matter to them.
  const stayed = assigneeIds.filter(a => !added.includes(a) && a !== user.id)
  if (stayed.length && (existing.title !== data.title || existing.due_date !== data.dueDate)) {
    const name = await actorName(supabase, user.id)
    await Promise.all(stayed.map(recipientId => sendNotification({
      recipientId,
      title: `${name} updated "${data.title}"`,
      body: existing.due_date !== data.dueDate ? `Due date is now ${data.dueDate ? formatDateDMY(data.dueDate) : 'unset'}` : 'Details changed',
      link: taskLink(existing.board_id, id),
      type: 'task_updated',
    })))
  }

  if (completing) await onTaskCompleted(supabase, user.id, id)

  refresh()
  return {}
}

export async function setTaskProgress(id: string, progress: TaskProgress): Promise<Result> {
  if (!(TASK_PROGRESS as readonly string[]).includes(progress)) return { error: 'Invalid progress' }
  const { supabase, user } = await getActor()
  if (!user) return { error: 'Not authenticated' }

  const { data: existing } = await supabase.from('tasks').select('progress, completed_at').eq('id', id).maybeSingle()
  if (!existing) return { error: 'Task not found' }

  const { error } = await supabase.from('tasks').update({
    progress,
    completed_at: progress === 'completed' ? (existing.completed_at ?? new Date().toISOString()) : null,
    updated_by: user.id,
  }).eq('id', id)
  if (error) return { error: error.message }

  if (progress === 'completed' && existing.progress !== 'completed') await onTaskCompleted(supabase, user.id, id)

  refresh()
  return {}
}

/** Drag-and-drop: the card's new bucket and its (client-computed) position within it. */
export async function moveTask(id: string, bucketId: string, position: number): Promise<Result> {
  if (!Number.isFinite(position)) return { error: 'Invalid position' }
  const { supabase, user } = await getActor()
  if (!user) return { error: 'Not authenticated' }
  const { error } = await supabase.from('tasks').update({ bucket_id: bucketId, position, updated_by: user.id }).eq('id', id)
  if (error) return { error: error.message }
  refresh()
  return {}
}

export async function deleteTask(id: string): Promise<Result> {
  const { supabase, user } = await getActor()
  if (!user) return { error: 'Not authenticated' }

  const { data: task } = await supabase.from('tasks').select('title, assignee_ids').eq('id', id).maybeSingle()

  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) return { error: error.message }

  const recipients = (task?.assignee_ids ?? []).filter(a => a !== user.id)
  if (task && recipients.length) {
    const name = await actorName(supabase, user.id)
    await Promise.all(recipients.map(recipientId => sendNotification({
      recipientId,
      title: `${name} deleted "${task.title}"`,
      body: 'This task was removed.',
      link: '/tasks',
      type: 'task_deleted',
    })))
  }

  refresh()
  return {}
}
