'use client'

import Link from 'next/link'
import { BrandMark } from '@/components/ui/BrandMark'
import { Wordmark } from '@/components/ui/Wordmark'
import { usePathname, useRouter } from 'next/navigation'
import { Music2, ListMusic, Wallet, LogOut, CalendarDays, CalendarRange, StickyNote, SquareKanban, Building2, Settings, Mic, LayoutDashboard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ACTIVE_SETLIST_COOKIE } from '@/lib/setlist-context'
import type { User } from '@supabase/supabase-js'
import { NotificationBell } from './NotificationBell'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import type { WorkspaceOption } from '@/lib/workspace-options'
import { ThemeIconButton } from '@/components/ui/ThemeToggle'
import { MobileTabBar } from './MobileTabBar'
import { MobileTopBar } from './MobileTopBar'
import type { NotificationItem } from '@/types/notifications'

interface SidebarProps {
  user: User
  /** How many split payments this person still owes a bandmate — badged on the Finance link until each one's marked paid. */
  pendingPaymentCount?: number
  /** This user's notifications, sender names already resolved server-side. */
  notifications?: NotificationItem[]
  /** Workspaces this user belongs to, and which one is selected. */
  workspaces?: WorkspaceOption[]
  currentWorkspaceId?: string
}

const navGroups = [
  { label: null, items: [{ href: '/', label: 'Today', icon: LayoutDashboard }] },
  {
    label: 'Perform',
    items: [
      { href: '/shows', label: 'Shows', icon: CalendarDays },
      { href: '/setlists', label: 'Setlists', icon: ListMusic },
      { href: '/songs', label: 'Songs', icon: Music2 },
      { href: '/recordings', label: 'Recordings', icon: Mic },
    ],
  },
  { label: 'Money', items: [{ href: '/finance', label: 'Finance', icon: Wallet }] },
  {
    label: 'Organise',
    items: [
      { href: '/tasks', label: 'Tasks', icon: SquareKanban },
      { href: '/notes', label: 'Notes', icon: StickyNote },
      { href: '/calendar', label: 'Calendar', icon: CalendarRange },
      { href: '/event-management', label: 'Agencies', icon: Building2 },
    ],
  },
]

export function Sidebar({ user, pendingPaymentCount = 0, notifications = [], workspaces = [], currentWorkspaceId = '' }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Explicitly leaving to browse the song library — clears which setlist is
  // "active" so a song opened from here doesn't keep inheriting stale
  // setlist context. Any other nav item leaves it alone; opening a
  // different setlist's song naturally overwrites it anyway.
  const handleNavClick = (href: string) => {
    if (href === '/songs') {
      // Plain DOM/browser API write from an event handler — not a render or
      // effect — which is exactly where React's docs say this belongs.
      // eslint-disable-next-line react-hooks/immutability
      document.cookie = `${ACTIVE_SETLIST_COOKIE}=; path=/; max-age=0`
    }
  }

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  const nav = (
    <nav className="flex flex-1 flex-col gap-2.5 py-2">
      {navGroups.map((group, i) => (
        <div key={group.label ?? i} className="flex flex-col gap-0.5">
          {group.label && (
            <span className="px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted [@media(max-height:640px)]:hidden">{group.label}</span>
          )}
          {group.items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => handleNavClick(href)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                isActive(href)
                  ? 'bg-sidebar-active text-sidebar-active-fg'
                  : 'text-sidebar-fg hover:bg-sidebar-hover hover:text-sidebar-strong'
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1">{label}</span>
              {href === '/finance' && pendingPaymentCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                  {pendingPaymentCount}
                </span>
              )}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )

  const switcher = workspaces.length > 0 ? (
    <WorkspaceSwitcher workspaces={workspaces} currentId={currentWorkspaceId} />
  ) : null

  const footer = (
    <div className="flex items-center gap-1.5 border-t border-sidebar-border px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-bold text-sidebar-active-fg" title={user.email ?? ''}>
        {user.email?.[0].toUpperCase()}
      </div>
      <p className="min-w-0 flex-1 truncate text-xs text-sidebar-muted">{user.email}</p>
      <Link
        href="/settings"
        aria-label="Settings"
        className={cn(
          'rounded-md p-1.5 transition-colors',
          isActive('/settings') ? 'bg-sidebar-active text-sidebar-active-fg' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-strong'
        )}
      >
        <Settings className="h-4 w-4" />
      </Link>
      <ThemeIconButton className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-strong" />
      <button
        onClick={handleSignOut}
        aria-label="Sign out"
        className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-strong"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )

  const logo = (
    <Link href="/" className="flex items-center gap-2.5">
      <BrandMark className="ring-1 ring-sidebar-border" />
      <Wordmark tone="sidebar" className="text-lg text-sidebar-strong" />
    </Link>
  )

  return (
    <>
      {/* Desktop: workspace rail + sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-2.5">
          {logo}
          <NotificationBell notifications={notifications} />
        </div>
        {switcher}
        <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto px-3">
          {nav}
        </div>
        {footer}
      </aside>

      {/* Phone: workspace + notifications on top, tabs at the bottom (everything else lives under "More") */}
      <MobileTopBar workspaces={workspaces} currentId={currentWorkspaceId} notifications={notifications} />
      <MobileTabBar pendingPaymentCount={pendingPaymentCount} />
    </>
  )
}
