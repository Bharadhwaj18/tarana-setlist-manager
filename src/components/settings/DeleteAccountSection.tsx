'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toaster'
import { deleteAccount } from '@/actions/account'
import { DELETE_CONFIRMATION } from '@/lib/account-deletion'

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const submit = () => {
    startTransition(async () => {
      // On success the action signs out and redirects, so only errors come back.
      const result = await deleteAccount(confirmation)
      if (result?.error) toast(result.error, 'error')
    })
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" /> Delete my account
      </Button>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        This permanently deletes your login, your personal space, and any band only you are in. Bands you share
        keep their history, shown under &ldquo;Deleted user&rdquo;. This can&apos;t be undone.
      </p>
      <Input
        aria-label={`Type ${DELETE_CONFIRMATION} to confirm`}
        placeholder={`Type ${DELETE_CONFIRMATION} to confirm`}
        value={confirmation}
        onChange={e => setConfirmation(e.target.value)}
      />
      <div className="flex gap-2">
        <Button variant="danger" size="sm" loading={isPending} disabled={confirmation.trim() !== DELETE_CONFIRMATION} onClick={submit}>
          Delete account
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setConfirmation('') }}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
