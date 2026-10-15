'use client'

import { useState } from 'react'
import { APP_EMAIL_PLACEHOLDER } from '@/lib/brand'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loginSchema, type LoginFormData } from '@/lib/validators'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'

export function LoginForm({ next = '/' }: { next?: string }) {
  const router = useRouter()
  const [serverError, setServerError] = useState('')
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setServerError('')
    const { error } = await supabase.auth.signInWithPassword(data)
    if (error) {
      setServerError(error.message === 'Invalid login credentials'
        ? 'Wrong email or password. New here, or forgot it? Use “Email me a link” instead.'
        : error.message)
      return
    }
    router.push(next)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder={APP_EMAIL_PLACEHOLDER}
          className="mt-1"
          error={errors.email?.message}
          {...register('email')}
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          className="mt-1"
          error={errors.password?.message}
          {...register('password')}
        />
      </div>
      {serverError && (
        <p className="text-sm text-red-600">{serverError}</p>
      )}
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Sign in
      </Button>
    </form>
  )
}
