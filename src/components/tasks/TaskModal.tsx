'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toaster'
import { createLabel, deleteTask, updateTask } from '@/actions/tasks'
import { AssigneePicker } from './AssigneePicker'
import { cn } from '@/lib/utils'
import {
  LABEL_COLORS, PRIORITY_LABELS, PROGRESS_LABELS, RECURRENCE_LABELS, REMINDER_PRESETS,
  TASK_PRIORITIES, TASK_PROGRESS, TASK_RECURRENCE, labelStyle,
  type LabelColor, type Member, type TaskBucket, type TaskLabel, type TaskPriority, type TaskProgress, type TaskRecurrence, type Task,
} from '@/types/tasks'

interface Props {
  task: Task
  buckets: TaskBucket[]
  labels: TaskLabel[]
  members: Member[]
  onClose: () => void
}

const CUSTOM = 'custom'
const selectClass = 'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

interface ChecklistField { id?: string; text: string; done: boolean }

function initialFields(task: Task) {
  const preset = REMINDER_PRESETS.some(p => p.value === task.remind_days_before)
  return {
    title: task.title,
    description: task.description ?? '',
    bucketId: task.bucket_id,
    progress: task.progress as TaskProgress,
    priority: task.priority as TaskPriority,
    startDate: task.start_date ?? '',
    dueDate: task.due_date ?? '',
    remindPreset: task.remind_days_before == null ? '' : preset ? String(task.remind_days_before) : CUSTOM,
    remindCustom: task.remind_days_before != null && !preset ? String(task.remind_days_before) : '',
    recurrence: (task.recurrence ?? '') as TaskRecurrence | '',
    assigneeIds: task.assignee_ids,
    labelIds: task.label_ids,
    checklist: task.checklist.map((c): ChecklistField => ({ id: c.id, text: c.text, done: c.done })),
  }
}

/** Mount with a `key` of the task id so the form always starts from that task. */
export function TaskModal({ task, buckets, labels, members, onClose }: Props) {
  const [fields, setFields] = useState(() => initialFields(task))
  const [newItem, setNewItem] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newLabelColor, setNewLabelColor] = useState<LabelColor>('blue')
  const [localLabels, setLocalLabels] = useState<TaskLabel[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const toast = useToast()

  const set = <K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) => setFields(prev => ({ ...prev, [key]: value }))
  const allLabels = [...labels, ...localLabels.filter(l => !labels.some(x => x.id === l.id))]

  const addItem = () => {
    if (!newItem.trim()) return
    set('checklist', [...fields.checklist, { text: newItem.trim(), done: false }])
    setNewItem('')
  }

  const addLabel = () => {
    const name = newLabel.trim()
    if (!name) return
    startTransition(async () => {
      const result = await createLabel(task.board_id, { name, color: newLabelColor })
      if (result.error || !result.id) {
        toast(result.error ?? 'Could not add the label', 'error')
        return
      }
      setLocalLabels(prev => [...prev, { id: result.id!, board_id: task.board_id, workspace_id: task.workspace_id, name, color: newLabelColor, created_at: new Date().toISOString() }])
      set('labelIds', [...fields.labelIds, result.id])
      setNewLabel('')
    })
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fields.title.trim()) return
    setError(null)
    startTransition(async () => {
      const remindDaysBefore = !fields.dueDate ? null
        : fields.remindPreset === CUSTOM ? (fields.remindCustom ? parseInt(fields.remindCustom, 10) : null)
        : fields.remindPreset !== '' ? parseInt(fields.remindPreset, 10) : null
      const result = await updateTask(task.id, {
        title: fields.title,
        description: fields.description || null,
        bucketId: fields.bucketId,
        progress: fields.progress,
        priority: fields.priority,
        startDate: fields.startDate || null,
        dueDate: fields.dueDate || null,
        remindDaysBefore,
        recurrence: fields.dueDate ? (fields.recurrence || null) : null,
        assigneeIds: fields.assigneeIds,
        labelIds: fields.labelIds,
        checklist: fields.checklist,
      })
      if (result.error) {
        setError(result.error)
        toast(result.error, 'error')
      } else {
        toast('Saved', 'success')
        onClose()
      }
    })
  }

  const remove = () => {
    startTransition(async () => {
      const result = await deleteTask(task.id)
      if (result.error) toast(result.error, 'error')
      else {
        toast('Task deleted', 'success')
        onClose()
      }
    })
  }

  const doneCount = fields.checklist.filter(c => c.done).length

  return (
    <Modal open onOpenChange={o => { if (!o) onClose() }} title="Task" className="max-w-2xl">
      <form onSubmit={save} className="space-y-5">
        <div>
          <Label htmlFor="task-title">Title *</Label>
          <Input id="task-title" className="mt-1" value={fields.title} onChange={e => set('title', e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="task-bucket">Bucket</Label>
            <select id="task-bucket" className={selectClass} value={fields.bucketId} onChange={e => set('bucketId', e.target.value)}>
              {buckets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="task-progress">Progress</Label>
            <select id="task-progress" className={selectClass} value={fields.progress} onChange={e => set('progress', e.target.value as TaskProgress)}>
              {TASK_PROGRESS.map(p => <option key={p} value={p}>{PROGRESS_LABELS[p]}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="task-priority">Priority</Label>
            <select id="task-priority" className={selectClass} value={fields.priority} onChange={e => set('priority', e.target.value as TaskPriority)}>
              {TASK_PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="task-start">Start date</Label>
            <Input id="task-start" type="date" className="mt-1" value={fields.startDate} onChange={e => set('startDate', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="task-due">Due date</Label>
            <Input id="task-due" type="date" className="mt-1" value={fields.dueDate} onChange={e => set('dueDate', e.target.value)} />
          </div>
        </div>

        {fields.dueDate && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="task-remind">Remind assignees</Label>
              <select id="task-remind" className={selectClass} value={fields.remindPreset} onChange={e => set('remindPreset', e.target.value)}>
                <option value="">No reminder</option>
                {REMINDER_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                <option value={CUSTOM}>Custom...</option>
              </select>
              {fields.remindPreset === CUSTOM && (
                <Input type="number" min="0" step="1" placeholder="Days before" className="mt-1.5" value={fields.remindCustom} onChange={e => set('remindCustom', e.target.value)} />
              )}
            </div>
            <div>
              <Label htmlFor="task-repeat">Repeat</Label>
              <select id="task-repeat" className={selectClass} value={fields.recurrence} onChange={e => set('recurrence', e.target.value as TaskRecurrence | '')}>
                <option value="">Doesn&apos;t repeat</option>
                {TASK_RECURRENCE.map(r => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}
              </select>
            </div>
            {fields.recurrence && (
              <p className="col-span-2 text-xs text-gray-500">
                When this is marked completed, the next {RECURRENCE_LABELS[fields.recurrence].toLowerCase()} copy is created in the board&apos;s first bucket.
              </p>
            )}
          </div>
        )}

        <div>
          <Label>Assigned to</Label>
          <div className="mt-1.5"><AssigneePicker members={members} value={fields.assigneeIds} onChange={ids => set('assigneeIds', ids)} /></div>
        </div>

        <div>
          <Label>Labels</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {allLabels.map(l => {
              const on = fields.labelIds.includes(l.id)
              return (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('labelIds', on ? fields.labelIds.filter(id => id !== l.id) : [...fields.labelIds, l.id])}
                  className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity', labelStyle(l.color).chip, on ? 'ring-2 ring-brand-500' : 'opacity-60 hover:opacity-100')}
                >
                  {l.name}
                </button>
              )
            })}
            {!allLabels.length && <span className="text-xs text-gray-400">No labels on this board yet — add one below.</span>}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Input
              placeholder="New label..."
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLabel() } }}
              className="max-w-[12rem]"
            />
            <div className="flex items-center gap-1">
              {LABEL_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewLabelColor(c)}
                  aria-label={c}
                  className={cn('h-5 w-5 rounded-full border-2', labelStyle(c).dot, newLabelColor === c ? 'border-gray-900' : 'border-transparent')}
                />
              ))}
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addLabel}>Add</Button>
          </div>
        </div>

        <div>
          <Label htmlFor="task-desc">Notes</Label>
          <Textarea id="task-desc" rows={4} className="mt-1" placeholder="Add more detail..." value={fields.description} onChange={e => set('description', e.target.value)} />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <Label>Checklist</Label>
            {fields.checklist.length > 0 && <span className="text-xs text-gray-400">{doneCount} of {fields.checklist.length}</span>}
          </div>
          <div className="mt-1.5 space-y-1.5">
            {fields.checklist.map((item, i) => (
              <div key={item.id ?? `new-${i}`} className="flex items-center gap-2 rounded-md bg-gray-50 px-2.5 py-1.5">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={e => set('checklist', fields.checklist.map((c, j) => (j === i ? { ...c, done: e.target.checked } : c)))}
                  className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                  aria-label={`Mark "${item.text}" done`}
                />
                <span className={cn('min-w-0 flex-1 truncate text-sm', item.done ? 'text-gray-400 line-through' : 'text-gray-700')}>{item.text}</span>
                <button type="button" onClick={() => set('checklist', fields.checklist.filter((_, j) => j !== i))} className="shrink-0 text-gray-400 hover:text-red-500" aria-label="Remove item">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Add an item..."
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
              />
              <Button type="button" variant="secondary" size="sm" onClick={addItem}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between gap-3 pt-1">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Delete this task?</span>
              <Button type="button" variant="danger" size="sm" onClick={remove} loading={isPending}>Delete</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Keep</Button>
            </div>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isPending} disabled={!fields.title.trim()}>Save</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
