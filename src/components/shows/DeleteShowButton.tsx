'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { deleteShow } from '@/actions/shows'
import { useToast } from '@/components/ui/Toaster'

export function DeleteShowButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleDelete = async () => {
    setLoading(true)
    const result = await deleteShow(id)
    if (result?.error) {
      toast(result.error, 'error')
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Delete show?"
        description="This will permanently delete the show. Any linked setlist and finance transactions will keep existing, but lose their link to it."
      >
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={loading} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </>
  )
}
