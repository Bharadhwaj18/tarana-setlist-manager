'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/Modal'
import { updateNote } from '@/actions/notes'
import { useToast } from '@/components/ui/Toaster'
import { NoteForm, fieldsFrom, hasContent, toFormData, type LinkTargets, type NoteFields } from './NoteForm'
import type { Note, ChecklistItem } from '@/types'

interface Props {
  note: Note
  checklistItems: ChecklistItem[]
  links: LinkTargets
  canChangeVisibility: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Edits a note. There is no Save button: closing the dialog keeps your changes, like Google Keep. */
export function NoteModal({ note, checklistItems, links, canChangeVisibility, open, onOpenChange }: Props) {
  const [fields, setFields] = useState<NoteFields>(() => fieldsFrom(note, checklistItems))
  const [initial, setInitial] = useState(() => JSON.stringify(fieldsFrom(note, checklistItems)))
  const [, startTransition] = useTransition()
  const toast = useToast()

  // Start from the latest saved note every time the dialog opens.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      const fresh = fieldsFrom(note, checklistItems)
      setFields(fresh)
      setInitial(JSON.stringify(fresh))
    }
  }

  const close = () => {
    onOpenChange(false)
    if (JSON.stringify(fields) === initial || !hasContent(fields)) return
    startTransition(async () => {
      const result = await updateNote(note.id, toFormData(fields))
      if (result.error) toast(result.error, 'error')
    })
  }

  return (
    <Modal open={open} onOpenChange={o => (o ? onOpenChange(true) : close())} title="Edit note" className={'max-w-xl'}>
      <div className="mt-3">
        <NoteForm fields={fields} onChange={setFields} links={links} canChangeVisibility={canChangeVisibility} />
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-gray-400">Changes are saved when you close</p>
          <button type="button" onClick={close} className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white hover:bg-brand-500">Done</button>
        </div>
      </div>
    </Modal>
  )
}
