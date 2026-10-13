'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarDays, ListMusic, Wallet, Ellipsis } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/', label: 'Today', icon: LayoutDashboard },
  { href: '/shows', label: 'Shows', icon: CalendarDays },
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

export function MobileTabBar({ pendingPaymentCount = 0 }: { pendingPaymentCount?: number }) {
  const pathname = usePathname()
  const active = activeHref(pathname)

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-brand-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const isActive = href === active
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2"
          >
            <span className={cn('relative flex h-7 w-14 items-center justify-center rounded-full transition-colors', isActive ? 'bg-brand-100 text-brand-700' : 'text-gray-500')}>
              <Icon className="h-[22px] w-[22px]" />
              {href === '/finance' && pendingPaymentCount > 0 && (
                <span className="absolute right-2 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {pendingPaymentCount}
                </span>
              )}
            </span>
            <span className={cn('text-[11px]', isActive ? 'font-extrabold text-gray-900' : 'font-semibold text-gray-500')}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
