'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Music2, ListMusic, LogOut, Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import type { User } from '@supabase/supabase-js'

function LogoImage() {
  const [imgError, setImgError] = useState(false)
  if (imgError) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-400 shadow-sm">
        <Music2 className="h-4 w-4 text-white" />
      </div>
    )
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-900 shadow-sm">
      <img
        src="/logo.png"
        alt="Tarana"
        className="h-6 w-6 object-contain"
        onError={() => setImgError(true)}
      />
    </div>
  )
}

interface SidebarProps {
  user: User
}

const navItems = [
  { href: '/songs', label: 'Songs', icon: Music2 },
  { href: '/setlists', label: 'Setlists', icon: ListMusic },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 py-4">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setMobileOpen(false)}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname.startsWith(href)
              ? 'bg-brand-200 text-gray-900'
              : 'text-gray-700 hover:bg-brand-100 hover:text-gray-900'
          )}
        >
          <Icon className="h-5 w-5 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  )

  const footer = (
    <div className="border-t border-brand-200 p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-400 text-xs font-bold text-white">
          {user.email?.[0].toUpperCase()}
        </div>
        <p className="truncate text-xs text-gray-600">{user.email}</p>
      </div>
      <button
        onClick={handleSignOut}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-brand-100 hover:text-gray-900"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  )

  const logo = (
    <div className="flex items-center gap-2.5">
      <LogoImage />
      <span className="font-bold text-gray-900">Tarana</span>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-brand-200 bg-brand-300 lg:flex">
        <div className="flex items-center border-b border-brand-200 px-4 py-4">
          {logo}
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto px-3">
          {nav}
        </div>
        {footer}
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-brand-200 bg-brand-300 px-4 py-3 lg:hidden">
        {logo}
        <button onClick={() => setMobileOpen(v => !v)} className="rounded-md p-1.5 text-gray-600 hover:bg-brand-100">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      <div className={cn('fixed inset-0 z-30 lg:hidden', mobileOpen ? 'pointer-events-auto' : 'pointer-events-none')}>
        <div
          className={cn('absolute inset-0 bg-black/30 transition-opacity duration-300', mobileOpen ? 'opacity-100' : 'opacity-0')}
          onClick={() => setMobileOpen(false)}
        />
        <aside className={cn(
          'absolute left-0 top-0 flex h-full w-56 flex-col bg-brand-300 shadow-xl transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
          <div className="flex items-center border-b border-brand-200 px-4 py-4">
            {logo}
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto px-3">
            {nav}
          </div>
          {footer}
        </aside>
      </div>
    </>
  )
}
