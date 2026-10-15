'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Mail } from 'lucide-react'
import { APP_EMAIL_PLACEHOLDER } from '@/lib/brand'
import { createClient } from '@/lib/supabase/client'
import { signUpSchema, type SignUpFormData } from '@/lib/validators'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'

/**
 * New account with name, email and password. The project asks new accounts to confirm their email,
 * so this usually ends on "check your inbox"; the link in that email signs them in and brings them
 * back to `next` (an invite, if they came from one).
 */
export function SignUpForm({ next = '/', onUseSignIn }: { next?: string; onUseSignIn: () => void }) {
  const router = useRouter()
  const supabase = createClient()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [serverError, setServerError] = useState<'exists' | string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  })

  const onSubmit = async (data: SignUpFormData) => {
    setServerError(null)
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        data: { display_name: data.name.trim() },
      },
    })
    if (error) {
      setServerError(/already registered|already exists/i.test(error.message) ? 'exists' : error.message)
      return
    }
    // Supabase hides whether an email is taken: an existing account comes back with no identities.
    if (result.user && result.user.identities?.length === 0) {
      setServerError('exists')
      return
    }
    if (result.session) {
      router.push(next)
      router.refresh()
      return
    }
    setSentTo(data.email)
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <Mail className="h-10 w-10 text-brand-600" />
        <p className="font-medium text-gray-900">Confirm your email</p>
        <p className="text-sm text-gray-500">
          We sent a link to <strong>{sentTo}</strong>. Open it on this same phone or computer to finish creating your account.
        </p>
        <p className="text-xs text-gray-400">Not there? Check spam, or wait a minute.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="signup-name">Your name</Label>
        <Input id="signup-name" autoComplete="name" placeholder="e.g. Shreyas" className="mt-1" error={errors.name?.message} {...register('name')} />
        <p className="mt-1 text-xs text-gray-500">This is how your bandmates will see you.</p>
      </div>
      <div>
        <Label htmlFor="signup-email">Email</Label>
        <Input id="signup-email" type="email" autoComplete="email" placeholder={APP_EMAIL_PLACEHOLDER} className="mt-1" error={errors.email?.message} {...register('email')} />
      </div>
      <div>
        <Label htmlFor="signup-password">Password</Label>
        <div className="relative mt-1">
          <Input id="signup-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" className="pr-10"
            error={errors.password?.message} {...register('password')} />
          <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-2 rounded p-0.5 text-gray-400 hover:text-gray-600">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {serverError === 'exists' ? (
        <p className="text-sm text-red-600">
          There’s already an account with this email.{' '}
          <button type="button" onClick={onUseSignIn} className="font-semibold underline">Sign in instead</button>
        </p>
      ) : serverError ? (
        <p className="text-sm text-red-600">{serverError}</p>
      ) : null}
      <Button type="submit" className="w-full" loading={isSubmitting}>Create account</Button>
    </form>
  )
}
