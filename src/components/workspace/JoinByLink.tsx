'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { extractInviteToken } from './constants'

/** Paste an invite link (or just its code) and go straight to the invite page. */
export function JoinByLink() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const go = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const token = extractInviteToken(value)
    if (!token) {
      setError('That doesn’t look like an invite link. Paste the whole link you were sent.')
      return
    }
    router.push(`/invite/${encodeURIComponent(token)}`)
  }

  return (
    <form onSubmit={go} className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={e => { setValue(e.target.value); setError(null) }}
          placeholder="Paste an invite link"
          aria-label="Invite link"
          autoComplete="off"
        />
        <Button type="submit" variant="secondary" disabled={!value.trim()}>Continue</Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}
