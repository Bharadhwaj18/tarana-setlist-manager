'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { createNote, updateNote, type NoteFormData, type ChecklistItemInput } from '@/actions/notes'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import { NOTE_COLORS, NOTE_COLOR_CLASSES, RECURRENCE_OPTIONS, RECURRENCE_LABELS, REMINDER_PRESETS } from '@/types/notes'
import type { Note, ChecklistItem } from '@/types'

interface Member { id: string; name: string }

interface Props {
  /** Present = edit this note instead of creating a new one. */
  note?: Note
  /** This note's current checklist items, if editing one that has any. */
  checklistItems?: ChecklistItem[]
  members: Member[]
  /** Controlled visibility — pass both to drive this from outside (e.g. a whole tappable card opening it) instead of the built-in pencil trigger, which is skipped entirely when these are provided. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Pre-fills the due date (e.g. opened from a specific day on the Calendar). */
  defaultDueDate?: string
}

const UNASSIGNED = ''
const CUSTOM_REMINDER = 'custom'

function fieldsFrom(note: Note | undefined, checklistItems: ChecklistItem[], defaultDueDate: string | undefined) {
  const preset = REMINDER_PRESETS.some(p => p.value === note?.remind_days_before)
  return {
    title: note?.title ?? '',
    content: note?.content ?? '',
    assignedTo: note?.assigned_to ?? UNASSIGNED,
    dueDate: note?.due_date ?? defaultDueDate ?? '',
    remindPreset: note?.remind_days_before == null ? '' : preset ? String(note.remind_days_before) : CUSTOM_REMINDER,
    remindCustom: note?.remind_days_before != null && !preset ? String(note.remind_days_before) : '',
    pinned: note?.pinned ?? false,
    color: note?.color ?? '',
    recurrence: note?.recurrence ?? '',
    labels: (note?.labels ?? []).join(', '),
    checklist: checklistItems.map((i): ChecklistItemInput => ({ id: i.id, text: i.text, assignedTo: i.assigned_to })),
  }
}

export function NoteModal({ note, checklistItems = [], members, open: controlledOpen, onOpenChange, defaultDueDate }: Props) {
  const isEdit = !!note
  const isControlled = controlledOpen !== undefined && onOpenChange !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange : setInternalOpen
  const [fields, setFields] = useState(() => fieldsFrom(note, checklistItems, defaultDueDate))
  const [newItemText, setNewItemText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  // Reset the form fresh every time the modal opens — React's documented
  // "adjust state during render" pattern rather than an effect.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setFields(fieldsFrom(note, checklistItems, defaultDueDate))
      setNewItemText('')
      setError(null)
    }
  }

  const set = <K extends keyof typeof fields>(key: K, value: typeof fields[K]) =>
    setFields(prev => ({ ...prev, [key]: value }))

  const canSubmit = fields.title.trim() !== ''

  const addChecklistItem = () => {
    if (!newItemText.trim()) return
    set('checklist', [...fields.checklist, { text: newItemText.trim(), assignedTo: null }])
    setNewItemText('')
  }
  const removeChecklistItem = (index: number) => set('checklist', fields.checklist.filter((_, i) => i !== index))
  const setChecklistAssignee = (index: number, assignedTo: string) =>
    set('checklist', fields.checklist.map((item, i) => i === index ? { ...item, assignedTo: assignedTo || null } : item))

  const remindeeName = (fields.assignedTo && members.find(m => m.id === fields.assignedTo)?.name) || 'you'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)

    startTransition(async () => {
      const remindDaysBefore = fields.dueDate
        ? fields.remindPreset === CUSTOM_REMINDER
          ? (fields.remindCustom ? parseInt(fields.remindCustom, 10) : null)
          : fields.remindPreset !== '' ? parseInt(fields.remindPreset, 10) : null
        : null

      const data: NoteFormData = {
        title: fields.title,
        content: fields.content,
        assignedTo: fields.assignedTo || null,
        dueDate: fields.dueDate || null,
        remindDaysBefore,
        pinned: fields.pinned,
        color: fields.color || null,
        recurrence: fields.dueDate ? (fields.recurrence || null) : null,
        labels: fields.labels.split(',').map(l => l.trim()).filter(Boolean),
        checklistItems: fields.checklist,
      }
      const result = isEdit ? await updateNote(note.id, data) : await createNote(data)
      if (result.error) {
        setError(result.error)
        toast(result.error, 'error')
      } else {
        toast(isEdit ? 'Saved' : 'Added', 'success')
        setOpen(false)
      }
    })
  }

  return (
    <>
      {isControlled ? null : isEdit ? (
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-brand-50 hover:text-brand-500"
          aria-label="Edit note"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Note
        </Button>
      )}

      <Modal open={open} onOpenChange={setOpen} title={isEdit ? 'Edit' : 'New Note or Task'} className="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="note-title">Title *</Label>
            <Input id="note-title" className="mt-1" placeholder="Rehearsal plan" value={fields.title} onChange={e => set('title', e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="note-content">Content</Label>
            <Textarea id="note-content" rows={4} className="mt-1" placeholder="Write anything..." value={fields.content} onChange={e => set('content', e.target.value)} />
          </div>

          {/* Checklist — each item is its own tiny assignable checkpoint,
              like a Jira subtask, not just plain text. */}
          <div>
            <Label>Checklist</Label>
            <p className="mt-0.5 text-xs text-gray-400">Each item can go to a different person</p>
            <div className="mt-1.5 space-y-1.5">
              {fields.checklist.map((item, i) => (
                <div key={item.id ?? `new-${i}`} className="flex items-center gap-2 rounded-md bg-gray-50 px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{item.text}</span>
                  <select
                    className="shrink-0 rounded border-0 bg-transparent py-0.5 pl-1 pr-5 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    value={item.assignedTo ?? UNASSIGNED}
                    onChange={e => setChecklistAssignee(i, e.target.value)}
                    aria-label={`Assign "${item.text}"`}
                  >
                    <option value={UNASSIGNED}>Unassigned</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <button type="button" onClick={() => removeChecklistItem(i)} className="shrink-0 text-gray-400 hover:text-red-500" aria-label="Remove item">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  placeholder="Add an item..."
                  value={newItemText}
                  onChange={e => setNewItemText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
                />
                <Button type="button" variant="secondary" size="sm" onClick={addChecklistItem}>Add</Button>
              </div>
            </div>
          </div>

          {/* Task details */}
          <div className="space-y-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Task Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="note-assignee">Assign to</Label>
                <select
                  id="note-assignee"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  value={fields.assignedTo}
                  onChange={e => set('assignedTo', e.target.value)}
                >
                  <option value={UNASSIGNED}>Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="note-due">Due date</Label>
                <Input id="note-due" type="date" className="mt-1" value={fields.dueDate} onChange={e => set('dueDate', e.target.value)} />
              </div>
            </div>
            {fields.dueDate && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="note-remind">Remind {remindeeName}</Label>
                    <select
                      id="note-remind"
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                      value={fields.remindPreset}
                      onChange={e => set('remindPreset', e.target.value)}
                    >
                      <option value="">No reminder</option>
                      {REMINDER_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      <option value={CUSTOM_REMINDER}>Custom...</option>
                    </select>
                    {fields.remindPreset === CUSTOM_REMINDER && (
                      <Input type="number" min="0" step="1" placeholder="Days before" className="mt-1.5" value={fields.remindCustom}
                        onChange={e => set('remindCustom', e.target.value)} />
                    )}
                  </div>
                  <div>
                    <Label htmlFor="note-recurrence">Repeat</Label>
                    <select
                      id="note-recurrence"
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                      value={fields.recurrence}
                      onChange={e => set('recurrence', e.target.value)}
                    >
                      <option value="">Doesn&apos;t repeat</option>
                      {RECURRENCE_OPTIONS.map(r => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}
                    </select>
                  </div>
                </div>
                {/* The relationship between a single due date and a repeat
                    rule isn't obvious from the fields alone — spell it out. */}
                {fields.recurrence && (
                  <p className="text-xs text-gray-500">
                    This due date is just for the next time. Once it&apos;s marked done, a new {RECURRENCE_LABELS[fields.recurrence as keyof typeof RECURRENCE_LABELS].toLowerCase()} copy is created automatically, due {fields.recurrence === 'daily' ? '1 day later' : fields.recurrence === 'weekly' ? '1 week later' : '1 month later'}.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Organize */}
          <div className="space-y-3">
            <div>
              <Label>Color</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => set('color', '')}
                  className={cn('h-7 w-7 rounded-full border-2 bg-white', fields.color === '' ? 'border-brand-500' : 'border-gray-200')}
                  aria-label="No color"
                />
                {NOTE_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('color', c)}
                    className={cn('h-7 w-7 rounded-full border-2', NOTE_COLOR_CLASSES[c].split(' ')[0], fields.color === c ? 'border-brand-500' : 'border-transparent')}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="note-labels">Labels</Label>
              <Input id="note-labels" placeholder="gigs, admin, urgent" className="mt-1" value={fields.labels} onChange={e => set('labels', e.target.value)} />
              <p className="mt-1 text-xs text-gray-400">Comma-separated</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={fields.pinned} onChange={e => set('pinned', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
              Pin to top
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending} disabled={!canSubmit}>{isEdit ? 'Save' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
