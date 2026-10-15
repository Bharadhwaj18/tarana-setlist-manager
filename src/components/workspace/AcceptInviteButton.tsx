'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInvite, dismissPendingInvite } from '@/actions/workspace'
import { Button } from '@/components/ui/Button'

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const accept = () => {
    setError(null)
    startTransition(async () => {
      const res = await acceptInvite(token)
      if (res.error) {
        setError(res.error)
        return
      }
      router.push('/')
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <Button onClick={accept} loading={pending} className="w-full">Join workspace</Button>
      <Button variant="secondary" className="w-full" disabled={pending}
        onClick={() => startTransition(async () => { await dismissPendingInvite(); router.push('/') })}>Not now</Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
