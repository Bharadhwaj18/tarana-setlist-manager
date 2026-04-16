'use client'

import { useState } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'
import { MagicLinkForm } from '@/components/auth/MagicLinkForm'
import { cn } from '@/lib/utils'

type Tab = 'password' | 'magic'

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('password')

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

      {tab === 'password' ? <LoginForm /> : <MagicLinkForm />}

      <p className="mt-6 text-center text-xs text-gray-400">
        New to Tarana? Ask a bandmate to invite you.
      </p>
    </div>
  )
}
