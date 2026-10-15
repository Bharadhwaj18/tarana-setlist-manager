'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Lock, LogOut } from 'lucide-react'
import { saveDisplayName } from '@/actions/profile'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useToast } from '@/components/ui/Toaster'
import { ProfilePhotoEditor } from './ProfilePhotoEditor'

const label = 'mb-1.5 block text-sm font-bold text-gray-800'

/** Your name and photo (the same in every workspace), your sign-in email, and signing out. */
export function ProfileSettings({ userId, name: initialName, email, avatarUrl }: { userId: string; name: string; email: string; avatarUrl: string | null }) {
  const router = useRouter()
  const toast = useToast()
  const [name, setName] = useState(initialName)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const dirty = name.trim() !== initialName && name.trim().length > 0

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await saveDisplayName(name)
      if (res.error) { setError(res.error); return }
      toast('Name saved', 'success')
      router.refresh()
    })
  }

  const signOut = () => {
    startTransition(async () => {
      await createClient().auth.signOut()
      router.push('/login')
    })
  }

  return (
    <div className="max-w-2xl space-y-4">
      <section className="flex flex-col items-center gap-6 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:p-6">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="relative">
            <UserAvatar name={name || initialName} id={userId} avatarUrl={avatarUrl} size={104} />
            <button type="button" onClick={() => setPhotoOpen(true)} aria-label="Change photo"
              className="absolute -bottom-0.5 -right-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-brand-400 text-white ring-4 ring-white hover:bg-brand-500">
              <Camera className="h-[18px] w-[18px]" />
            </button>
          </div>
          <button type="button" onClick={() => setPhotoOpen(true)} className="min-h-8 text-sm font-extrabold text-brand-600 hover:underline">
            {avatarUrl ? 'Change photo' : 'Add a photo'}
          </button>
        </div>

        <form onSubmit={save} className="w-full flex-1 space-y-4">
          <div>
            <label htmlFor="profile-name" className={label}>Your name</label>
            <Input id="profile-name" value={name} maxLength={40} autoComplete="name" onChange={e => setName(e.target.value)} className="min-h-12 text-base" />
            <p className="mt-1.5 text-xs leading-relaxed text-gray-500">This is how people see you in every workspace: on tasks, in finance and on the calendar.</p>
          </div>
          <div>
            <label htmlFor="profile-email" className={label}>Email</label>
            <div className="relative">
              <Input id="profile-email" value={email} readOnly className="min-h-12 pr-10 text-base text-gray-500" />
              <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">Used to sign in. It can’t be changed here.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={pending} disabled={!dirty} className="min-h-11 w-full sm:w-auto">Save</Button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[15px] font-bold text-gray-900">Sign out</p>
          <p className="text-sm text-gray-500">Signed in on this device as {email}.</p>
        </div>
        <button type="button" onClick={signOut} disabled={pending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-50 px-5 text-sm font-extrabold text-red-700 hover:bg-red-100 disabled:opacity-50">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </section>

      <ProfilePhotoEditor userId={userId} name={name || initialName} avatarUrl={avatarUrl} open={photoOpen} onOpenChange={setPhotoOpen} />
    </div>
  )
}
