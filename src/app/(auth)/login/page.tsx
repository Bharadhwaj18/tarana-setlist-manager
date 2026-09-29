'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { LoginForm } from '@/components/auth/LoginForm'
import { MagicLinkForm } from '@/components/auth/MagicLinkForm'
import { cn } from '@/lib/utils'
import { safeNextPath } from '@/lib/safe-redirect'

type Tab = 'password' | 'magic'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const [tab, setTab] = useState<Tab>('password')
  const nextParam = useSearchParams().get('next')
  const next = safeNextPath(nextParam)
  const fromInvite = next.startsWith('/invite/')

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-gray-900">Sign in to your account</h2>

      {/* Tabs */}
      <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
        {(['password', 'magic'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-sm font-medium transition-colors',
              tab === t
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t === 'password' ? 'Password' : 'Magic Link'}
          </button>
        ))}
      </div>

      {fromInvite && (
        <p className="mb-4 rounded-lg bg-brand-100 px-3 py-2 text-sm text-gray-700">
          Sign in or enter your email to join the workspace you were invited to.
        </p>
      )}

      {tab === 'password' ? <LoginForm next={next} /> : <MagicLinkForm next={next} />}

      <p className="mt-6 text-center text-xs text-gray-400">
        New here? Ask for an invite link.
      </p>
    </div>
  )
}
