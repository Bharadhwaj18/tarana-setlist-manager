'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { deleteSetlist } from '@/actions/setlists'
import { useToast } from '@/components/ui/Toaster'

export function DeleteSetlistButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleDelete = async () => {
    setLoading(true)
    try {
      await deleteSetlist(id)
    } catch {
      toast('Failed to delete setlist', 'error')
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
        title="Delete setlist?"
        description="This will permanently delete the setlist. Songs in your library will not be affected."
      >
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={loading} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </>
  )
}
