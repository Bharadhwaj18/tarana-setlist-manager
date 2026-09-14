'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { deleteEventManagement } from '@/actions/event-management'
import { useToast } from '@/components/ui/Toaster'

export function DeleteEventManagementButton({ id }: { id: string }) {
  const [isDeleting, startDeleteTransition] = useTransition()
  const toast = useToast()

  const handleDelete = () => {
    if (!window.confirm('Delete this agency? Shows already booked through it will keep existing, but lose their link to it.')) return
    startDeleteTransition(async () => {
      const result = await deleteEventManagement(id)
      if (result?.error) toast(result.error, 'error')
    })
  }

  return (
    <Button variant="danger" size="sm" loading={isDeleting} onClick={handleDelete}>
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}
