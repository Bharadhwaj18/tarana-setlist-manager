'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInvite } from '@/actions/workspace'
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
      router.push('/setlists')
      router.refresh()
    })
  }

  return (
    <div>
      <Button onClick={accept} loading={pending} className="w-full">Join workspace</Button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
