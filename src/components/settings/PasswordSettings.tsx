'use client'

import { useState, useTransition } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toaster'

const label = 'mb-1.5 block text-sm font-bold text-gray-800'

/** Set a password (people who joined with an email link have none) or change the current one. */
export function PasswordSettings() {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const problem = password.length > 0 && password.length < 8
    ? 'Use at least 8 characters.'
    : confirm.length > 0 && confirm !== password ? 'The two passwords don’t match.' : null

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (problem || password.length < 8 || confirm !== password) return
    setError(null)
    startTransition(async () => {
      const { error: err } = await createClient().auth.updateUser({ password })
      if (err) {
        setError(/different from the old/i.test(err.message) ? 'That’s already your password. Pick a new one.' : err.message)
        return
      }
      setPassword('')
      setConfirm('')
      toast('Password saved. You can now sign in with it.', 'success')
    })
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm font-semibold leading-relaxed">If you sign in with a link we email you, add a password here to sign in faster, even without your email to hand. You can also change an existing password.</p>
      </div>

      <form onSubmit={save} className="space-y-4 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
        <div>
          <label htmlFor="new-password" className={label}>New password</label>
          <div className="relative">
            <Input id="new-password" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="min-h-12 pr-11 text-base" />
            <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 hover:bg-brand-50">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">At least 8 characters.</p>
        </div>
        <div>
          <label htmlFor="confirm-password" className={label}>Type it again</label>
          <Input id="confirm-password" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className="min-h-12 text-base" />
        </div>
        {(problem || error) && <p className="text-sm text-red-600">{error ?? problem}</p>}
        <Button type="submit" loading={pending} disabled={password.length < 8 || confirm !== password} className="min-h-11 w-full sm:w-auto">Save password</Button>
      </form>
      <p className="text-center text-xs text-gray-500 sm:text-left">You can still use “Email me a link” whenever you like.</p>
    </div>
  )
}
