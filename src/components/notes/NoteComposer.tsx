'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { ListChecks, Sparkles } from 'lucide-react'
import { createNote } from '@/actions/notes'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import { NOTE_COLOR_CLASSES, type NoteColor } from '@/types/notes'
import { NoteForm, emptyFields, hasContent, toFormData, type LinkTargets, type NoteFields } from './NoteForm'

interface Props {
  links: LinkTargets
  /** Pre-link the new note (from a show or song page). */
  prefill?: { showId?: string; songId?: string }
  startOpen?: boolean
}

/** The "Take a note..." bar. It opens in place and saves when you click away, like Google Keep. */
export function NoteComposer({ links, prefill, startOpen = false }: Props) {
  const [open, setOpen] = useState(startOpen)
  const [fields, setFields] = useState<NoteFields>(() => emptyFields({ showId: prefill?.showId ?? '', songId: prefill?.songId ?? '' }))
  const [, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const toast = useToast()

  const finish = () => {
    setOpen(false)
    if (!hasContent(fields)) { setFields(emptyFields()); return }
    const data = toFormData(fields)
    setFields(emptyFields())
    startTransition(async () => {
      const result = await createNote(data)
      if (result.error) toast(result.error, 'error')
      else toast(data.visibility === 'shared' ? 'Note added for the workspace' : 'Note added (only you can see it)', 'success')
    })
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const el = ref.current
      if (el && !el.contains(e.target as Node) && !(e.target as HTMLElement).closest('[role="dialog"]')) finish()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
    // finish closes over the latest fields on every render, which is what we want here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fields])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-5 flex w-full items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-white px-4 py-3.5 text-left text-gray-400 shadow-sm hover:shadow-md"
      >
        <span className="text-sm">Take a note...</span>
        <span className="flex items-center gap-3 text-gray-400">
          <ListChecks className="h-5 w-5" aria-label="New list" />
          <Sparkles className="h-5 w-5" aria-label="Templates" />
        </span>
      </button>
    )
  }

  const colorClass = fields.color && fields.color in NOTE_COLOR_CLASSES ? NOTE_COLOR_CLASSES[fields.color as NoteColor] : 'bg-white border-brand-200'

  return (
    <div ref={ref} className={cn('mb-5 rounded-2xl border p-4 shadow-md', colorClass)}>
      <NoteForm fields={fields} onChange={setFields} links={links} showTemplates autoFocus />
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={finish} className="rounded-lg px-3 py-1.5 text-sm font-bold text-gray-700 hover:bg-black/5">Close</button>
      </div>
    </div>
  )
}
