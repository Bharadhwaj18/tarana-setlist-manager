'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteNote } from '@/actions/notes'
import { useToast } from '@/components/ui/Toaster'

export function DeleteNoteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteNote(id)
      if (result.error) toast(result.error, 'error')
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      aria-label="Delete note"
      className="shrink-0 text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}
