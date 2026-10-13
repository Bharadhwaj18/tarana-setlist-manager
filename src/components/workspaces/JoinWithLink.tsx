'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { parseInviteToken } from '@/lib/invite-link'

export function JoinWithLink() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (window.location.hash === '#join') inputRef.current?.focus()
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const token = parseInviteToken(value)
    if (!token) {
      setError('That doesn’t look like an invite link. Paste the whole link you were sent.')
      return
    }
    router.push(`/invite/${token}`)
  }

  return (
    <section id="join" className="scroll-mt-20 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-gray-700"><Compass className="h-5 w-5" /></span>
        <div>
          <h2 className="font-display text-lg font-bold text-gray-900">Join with an invite link</h2>
          <p className="text-xs text-gray-500">Paste the link someone sent you and we’ll take you to the invite.</p>
        </div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          value={value}
          onChange={e => { setValue(e.target.value); setError(null) }}
          placeholder="https://…/invite/…"
          aria-label="Invite link"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
        <Button type="submit" disabled={!value.trim()}>Continue</Button>
      </form>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  )
}
