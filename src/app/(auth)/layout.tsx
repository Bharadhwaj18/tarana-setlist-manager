import type { ReactNode } from 'react'
import Image from 'next/image'
import { APP_NAME, APP_TAGLINE } from '@/lib/brand'

export const dynamic = 'force-dynamic'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-300 to-brand-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-900 shadow-lg">
            <Image
              src="/logo.png"
              alt={APP_NAME}
              width={52}
              height={52}
              className="object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{APP_NAME}</h1>
          <p className="text-sm text-gray-500">{APP_TAGLINE}</p>
        </div>
        <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          {children}
        </div>
      </div>
    </div>
  )
}
