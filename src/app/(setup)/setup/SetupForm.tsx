'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { saveDisplayName } from '@/actions/profile'
import { Button } from '@/components/ui/Button'

export function SetupForm({ email }: { email: string }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await saveDisplayName(name)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo + heading */}
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Image
          src="/logo.png"
          alt="Tarana"
          width={64}
          height={64}
          className="rounded-2xl object-contain shadow-lg"
        />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Tarana!</h1>
          <p className="mt-1 text-sm text-gray-500">
            Set a display name so your bandmates can see who added or edited songs.
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
        <p className="mb-5 text-sm text-gray-500">
          Signed in as <span className="font-medium text-gray-700">{email}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="display-name" className="mb-1.5 block text-sm font-medium text-gray-700">
              Your name
            </label>
            <input
              id="display-name"
              type="text"
              autoFocus
              autoComplete="name"
              placeholder="e.g. Shreyas"
              maxLength={40}
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-md border border-brand-200 bg-white px-3 py-2.5 text-sm placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
            {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
          </div>

          <Button
            type="submit"
            className="w-full"
            loading={isPending}
            disabled={!name.trim()}
          >
            Continue
          </Button>
        </form>
      </div>
    </div>
  )
}
