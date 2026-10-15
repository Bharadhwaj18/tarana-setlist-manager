'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarDays, ListMusic, Wallet, Ellipsis } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sectionForHref, type SectionKey } from '@/lib/workspace-sections'

const TABS = [
  { href: '/', label: 'Today', icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/setlists', label: 'Setlists', icon: ListMusic },
  { href: '/finance', label: 'Finance', icon: Wallet },
  { href: '/more', label: 'More', icon: Ellipsis },
] as const

const MAIN_TABS = TABS.slice(0, 4)

/** Which tab owns the current page. Anything that isn't a main tab (Songs, Tasks, Settings...) belongs to More. */
function activeHref(pathname: string) {
  if (pathname === '/') return '/'
  const main = MAIN_TABS.find(t => t.href !== '/' && pathname.startsWith(t.href))
  return main ? main.href : '/more'
}

export function MobileTabBar({ pendingPaymentCount = 0, hiddenSections = [] }: { pendingPaymentCount?: number; hiddenSections?: SectionKey[] }) {
  const pathname = usePathname()
  const active = activeHref(pathname)
  const visible = TABS.filter(t => { const sec = sectionForHref(t.href); return !sec || !hiddenSections.includes(sec) })
  const activeIndex = visible.findIndex(t => t.href === active)
  const n = visible.length

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-brand-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {/* One pill that slides between tabs, instead of each tab lighting up on its own. */}
      {activeIndex >= 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-2 h-7 w-14 rounded-full bg-brand-100 transition-[left] duration-300 ease-out motion-reduce:transition-none"
          style={{ left: `calc(${((activeIndex + 0.5) * 100) / n}% - 1.75rem)` }}
        />
      )}
      {visible.map(({ href, label, icon: Icon }) => {
        const isActive = href === active
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2"
          >
            <span key={isActive ? 'on' : 'off'} className={cn('relative flex h-7 w-14 items-center justify-center rounded-full transition-colors', isActive ? 'text-brand-700' : 'text-gray-500', isActive && 'animate-pop-tap')}>
              <Icon className="h-[22px] w-[22px]" />
              {href === '/finance' && pendingPaymentCount > 0 && (
                <span key={pendingPaymentCount} className="animate-badge-bounce absolute right-2 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {pendingPaymentCount}
                </span>
              )}
            </span>
            <span className={cn('text-[11px] transition-colors', isActive ? 'font-extrabold text-gray-900' : 'font-semibold text-gray-500')}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
