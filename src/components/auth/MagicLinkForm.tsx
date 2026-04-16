'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { magicLinkSchema, type MagicLinkFormData } from '@/lib/validators'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Mail } from 'lucide-react'

export function MagicLinkForm() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState('')
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors, isSubmitting }, getValues } = useForm<MagicLinkFormData>({
    resolver: zodResolver(magicLinkSchema),
  })

  const onSubmit = async (data: MagicLinkFormData) => {
    setServerError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: data.email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setServerError(error.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <Mail className="h-10 w-10 text-indigo-600" />
        <p className="font-medium text-gray-900">Check your inbox</p>
        <p className="text-sm text-gray-500">
          We sent a magic link to <strong>{getValues('email')}</strong>. Click it to sign in.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="magic-email">Email</Label>
        <Input
          id="magic-email"
          type="email"
          placeholder="you@tarana.band"
          className="mt-1"
          error={errors.email?.message}
          {...register('email')}
        />
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Send magic link
      </Button>
    </form>
  )
}
