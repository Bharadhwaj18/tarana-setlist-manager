'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toaster'
import { deleteWorkspace, leaveWorkspace, transferOwnership } from '@/actions/workspace'
import type { MemberRow } from './settings-types'

interface Props {
  workspaceName: string
  members: MemberRow[]
  isAdmin: boolean
  isOwner: boolean
}

const card = 'rounded-2xl border border-brand-200 bg-white p-5 shadow-sm'
const heading = 'text-base font-bold text-gray-900'

export function DangerSettings({ workspaceName, members, isAdmin, isOwner }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [newOwner, setNewOwner] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const candidates = members.filter(m => !m.isYou && m.role !== 'owner')

  const run = (fn: () => Promise<{ error?: string }>, after: () => void) => {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (res.error) setError(res.error)
      else after()
    })
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!isOwner && (
        <section className={card}>
          <h2 className={heading}>Leave workspace</h2>
          <p className="mb-3 mt-1 text-sm text-gray-500">You’ll lose access to {workspaceName}’s songs, setlists and finances. Your personal space stays.</p>
          <Button
            variant="danger"
            loading={pending}
            onClick={() => { if (window.confirm(`Leave ${workspaceName}?`)) run(() => leaveWorkspace(), () => { router.push('/'); router.refresh() }) }}
          >
            Leave {workspaceName}
          </Button>
        </section>
      )}

      {isOwner && (
        <section className={card}>
          <h2 className={heading}>Transfer ownership</h2>
          <p className="mb-3 mt-1 text-sm text-gray-500">Hand this workspace to someone else. You’ll become an admin. Only the owner can do this.</p>
          {candidates.length === 0 ? (
            <p className="text-sm text-gray-400">There’s no one else in the workspace to hand it to yet.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select value={newOwner} onChange={e => setNewOwner(e.target.value)} aria-label="New owner" className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-gray-900">
                <option value="">Choose a member…</option>
                {candidates.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
              </select>
              <Button
                variant="secondary"
                loading={pending}
                disabled={!newOwner}
                onClick={() => {
                  const target = candidates.find(m => m.userId === newOwner)
                  if (target && window.confirm(`Make ${target.name} the owner of ${workspaceName}? You’ll become an admin.`)) {
                    run(() => transferOwnership(newOwner), () => { toast('Ownership transferred', 'success'); setNewOwner(''); router.refresh() })
                  }
                }}
              >
                Transfer
              </Button>
            </div>
          )}
        </section>
      )}

      {isAdmin && (
        <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-red-700">Delete workspace</h2>
          <p className="mb-3 mt-1 text-sm text-gray-500">
            Permanently deletes {workspaceName} for everyone: songs, setlists, shows, finances, notes, tasks, recordings and documents. This can’t be undone. Your personal space isn’t affected.
          </p>
          {!deleting ? (
            <Button variant="danger" onClick={() => setDeleting(true)}>Delete {workspaceName}…</Button>
          ) : (
            <form
              className="space-y-3"
              onSubmit={e => { e.preventDefault(); run(() => deleteWorkspace(confirmText), () => { router.push('/'); router.refresh() }) }}
            >
              <label className="block text-sm text-gray-700">
                Type <span className="font-bold">{workspaceName}</span> to confirm
                <Input className="mt-1" value={confirmText} onChange={e => setConfirmText(e.target.value)} autoComplete="off" />
              </label>
              <div className="flex gap-2">
                <Button type="submit" variant="danger" loading={pending} disabled={confirmText.trim() !== workspaceName}>Delete forever</Button>
                <Button type="button" variant="secondary" disabled={pending} onClick={() => { setDeleting(false); setConfirmText('') }}>Cancel</Button>
              </div>
            </form>
          )}
        </section>
      )}

    </div>
  )
}
