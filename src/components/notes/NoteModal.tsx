'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { createNote, updateNote, type NoteFormData } from '@/actions/notes'
import { useToast } from '@/components/ui/Toaster'
import type { Note } from '@/types'

interface Props {
  /** Present = edit this note instead of creating a new one. */
  note?: Note
  /** Controlled visibility — pass both to drive this from outside (e.g. a whole tappable card opening it) instead of the built-in pencil trigger, which is skipped entirely when these are provided. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function NoteModal({ note, open: controlledOpen, onOpenChange }: Props) {
  const isEdit = !!note
  const isControlled = controlledOpen !== undefined && onOpenChange !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange : setInternalOpen
  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  // Reset the form fresh every time the modal opens, whether that's the
  // built-in trigger below or a parent driving `open` directly. Adjusting
  // state during render (React's documented pattern for "reset state when
  // a prop changes") rather than in an effect.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setTitle(note?.title ?? '')
      setContent(note?.content ?? '')
    }
  }

  const canSubmit = title.trim() !== ''

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    startTransition(async () => {
      const data: NoteFormData = { title, content }
      const result = isEdit ? await updateNote(note.id, data) : await createNote(data)
      if (result.error) {
        toast(result.error, 'error')
      } else {
        toast(isEdit ? 'Note updated' : 'Note added', 'success')
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

      <Modal open={open} onOpenChange={setOpen} title={isEdit ? 'Edit Note' : 'New Note'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="note-title">Title *</Label>
            <Input id="note-title" className="mt-1" placeholder="Rehearsal plan" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="note-content">Content</Label>
            <Textarea id="note-content" rows={6} className="mt-1" placeholder="Write anything..." value={content ?? ''} onChange={e => setContent(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending} disabled={!canSubmit}>{isEdit ? 'Save' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
