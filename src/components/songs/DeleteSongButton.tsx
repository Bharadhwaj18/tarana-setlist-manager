'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { deleteSong } from '@/actions/songs'
import { useToast } from '@/components/ui/Toaster'

export function DeleteSongButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleDelete = async () => {
    setLoading(true)
    try {
      await deleteSong(id)
    } catch {
      toast('Failed to delete song', 'error')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-bold text-red-600 hover:underline"
      >
        Delete song
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Delete song?"
        description="This will permanently remove the song from the library. Setlists that include it will also lose it."
      >
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={loading} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </>
  )
}
