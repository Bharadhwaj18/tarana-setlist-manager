'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { LoginForm } from '@/components/auth/LoginForm'
import { MagicLinkForm } from '@/components/auth/MagicLinkForm'
import { SignUpForm } from '@/components/auth/SignUpForm'
import { cn } from '@/lib/utils'
import { safeNextPath } from '@/lib/safe-redirect'

type Tab = 'password' | 'magic'
type Mode = 'signin' | 'signup'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const params = useSearchParams()
  const next = safeNextPath(params.get('next'))
  const fromInvite = next.startsWith('/invite/')
  const linkFailed = params.get('error') === 'auth_failed'
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'signin')
  const [tab, setTab] = useState<Tab>(linkFailed ? 'magic' : 'password')

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">
        {mode === 'signup' ? (fromInvite ? 'Create your account to join' : 'Create your account') : fromInvite ? 'Sign in to join' : 'Sign in to your account'}
      </h2>
      <p className="mb-5 text-sm text-gray-500">
        {mode === 'signup' ? 'It takes a minute. You’ll confirm your email, then you’re in.' : 'Welcome back.'}
      </p>

      {linkFailed && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          That sign-in link didn’t work. It may have expired, or opened in a different app or browser from the one you asked for it in.
          Ask for a new link below, then open it on this same phone or computer.
        </p>
      )}

      {mode === 'signup' ? (
        <SignUpForm next={next} onUseSignIn={() => setMode('signin')} />
      ) : (
        <>
          <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
            {(['password', 'magic'] as Tab[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-sm font-medium transition-colors',
                  tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {t === 'password' ? 'Password' : 'Email me a link'}
              </button>
            ))}
          </div>
          {tab === 'password' ? <LoginForm next={next} /> : <MagicLinkForm next={next} />}
        </>
      )}

      <p className="mt-6 text-center text-sm text-gray-500">
        {mode === 'signup' ? (
          <>Already have an account? <button type="button" onClick={() => setMode('signin')} className="font-semibold text-brand-600 hover:underline">Sign in</button></>
        ) : (
          <>New here? <button type="button" onClick={() => setMode('signup')} className="font-semibold text-brand-600 hover:underline">Create an account</button></>
        )}
      </p>
    </div>
  )
}
