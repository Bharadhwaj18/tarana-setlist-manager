import type { ReactNode } from 'react'

export default function SetupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-300 to-brand-50 px-4">
      {children}
    </div>
  )
}
