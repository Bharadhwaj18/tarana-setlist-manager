'use client'

import { useState, useTransition } from 'react'
import { Plus, X, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { createNote, updateNote, type NoteFormData, type ChecklistItemInput } from '@/actions/notes'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import { NOTE_COLORS, NOTE_COLOR_CLASSES } from '@/types/notes'
import type { Note, ChecklistItem } from '@/types'

interface Props {
  /** Present = edit this note instead of creating a new one. */
  note?: Note
  checklistItems?: ChecklistItem[]
  /** Controlled visibility — pass both to drive this from outside (a tappable card); otherwise a "New note" button is rendered. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function fieldsFrom(note: Note | undefined, checklistItems: ChecklistItem[]) {
  return {
    title: note?.title ?? '',
    content: note?.content ?? '',
    pinned: note?.pinned ?? false,
    color: note?.color ?? '',
    labels: (note?.labels ?? []).join(', '),
    checklist: checklistItems.map((i): ChecklistItemInput => ({ id: i.id, text: i.text, done: i.done })),
  }
}

export function NoteModal({ note, checklistItems = [], open: controlledOpen, onOpenChange }: Props) {
  const isEdit = !!note
  const isControlled = controlledOpen !== undefined && onOpenChange !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange : setInternalOpen
  const [fields, setFields] = useState(() => fieldsFrom(note, checklistItems))
  const [newItemText, setNewItemText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  // Reset the form fresh every time the modal opens ("adjust state during render", not an effect).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setFields(fieldsFrom(note, checklistItems))
      setNewItemText('')
      setError(null)
    }
  }

  const set = <K extends keyof typeof fields>(key: K, value: typeof fields[K]) =>
    setFields(prev => ({ ...prev, [key]: value }))

  const addChecklistItem = () => {
    if (!newItemText.trim()) return
    set('checklist', [...fields.checklist, { text: newItemText.trim(), done: false }])
    setNewItemText('')
  }
  const toggleItem = (index: number) => set('checklist', fields.checklist.map((item, i) => i === index ? { ...item, done: !item.done } : item))
  const removeItem = (index: number) => set('checklist', fields.checklist.filter((_, i) => i !== index))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // A half-typed checklist item still counts — don't silently drop it.
    const checklistItems = newItemText.trim() ? [...fields.checklist, { text: newItemText.trim(), done: false }] : fields.checklist

    startTransition(async () => {
      const data: NoteFormData = {
        title: fields.title,
        content: fields.content,
        pinned: fields.pinned,
        color: fields.color || null,
        labels: fields.labels.split(',').map(l => l.trim()).filter(Boolean),
        checklistItems,
      }
      const result = isEdit ? await updateNote(note.id, data) : await createNote(data)
      if (result.error) {
        setError(result.error)
        toast(result.error, 'error')
      } else {
        toast(isEdit ? 'Saved' : 'Note added', 'success')
        setOpen(false)
      }
    })
  }

  return (
    <>
      {!isControlled && (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New note
        </Button>
      )}

      <Modal open={open} onOpenChange={setOpen} title={isEdit ? 'Edit note' : 'New note'} className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input aria-label="Title" className="text-base font-semibold" placeholder="Title" value={fields.title} onChange={e => set('title', e.target.value)} autoFocus />
          <Textarea aria-label="Note" rows={5} placeholder="Take a note..." value={fields.content} onChange={e => set('content', e.target.value)} />

          <div className="space-y-1.5">
            {fields.checklist.map((item, i) => (
              <div key={item.id ?? `new-${i}`} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleItem(i)}
                  aria-label={item.done ? 'Mark not done' : 'Mark done'}
                  className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border-2', item.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300')}
                >
                  {item.done && <Check className="h-2.5 w-2.5" />}
                </button>
                <span className={cn('min-w-0 flex-1 break-words text-sm text-gray-700', item.done && 'text-gray-400 line-through')}>{item.text}</span>
                <button type="button" onClick={() => removeItem(i)} className="shrink-0 text-gray-400 hover:text-red-500" aria-label="Remove item">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                aria-label="Add a checklist item"
                placeholder="Add a list item..."
                value={newItemText}
                onChange={e => setNewItemText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
              />
              <Button type="button" variant="secondary" size="sm" onClick={addChecklistItem}>Add</Button>
            </div>
          </div>

          <div>
            <Label>Colour</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => set('color', '')}
                className={cn('h-7 w-7 rounded-full border-2 bg-white', fields.color === '' ? 'border-brand-500' : 'border-gray-200')}
                aria-label="No colour"
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
            <Input id="note-labels" placeholder="gigs, ideas" className="mt-1" value={fields.labels} onChange={e => set('labels', e.target.value)} />
            <p className="mt-1 text-xs text-gray-400">Comma-separated</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={fields.pinned} onChange={e => set('pinned', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
            Pin to top
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending}>{isEdit ? 'Save' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
