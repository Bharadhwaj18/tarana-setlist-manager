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
}

export function NoteModal({ note }: Props) {
  const isEdit = !!note
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const openModal = () => {
    setTitle(note?.title ?? '')
    setContent(note?.content ?? '')
    setOpen(true)
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
      {isEdit ? (
        <button
          onClick={openModal}
          className="shrink-0 text-gray-300 opacity-0 transition-opacity hover:text-brand-500 group-hover:opacity-100"
          aria-label="Edit note"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : (
        <Button onClick={openModal}>
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
