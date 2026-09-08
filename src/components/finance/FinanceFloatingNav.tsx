'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { History, ArrowRightLeft, ScrollText } from 'lucide-react'

/**
 * Persistent bottom-right destinations — Split, History, and Split History
 * are places you go look at or act on, not things you do on the page
 * you're currently viewing, so they stay reachable from anywhere in
 * Finance without cluttering each page's own top action row. Whichever one
 * you're already on drops out of the list — no point linking to yourself.
 */
export function FinanceFloatingNav({ hasUnsplitShows }: { hasUnsplitShows: boolean }) {
  const pathname = usePathname()

  const items = [
    { href: '/finance/split', label: 'Split', icon: ArrowRightLeft, show: hasUnsplitShows, primary: true },
    { href: '/finance/history', label: 'History', icon: History, show: true, primary: false },
    { href: '/finance/split-history', label: 'Split History', icon: ScrollText, show: true, primary: false },
  ].filter(item => item.show && item.href !== pathname)

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-2">
      {items.map(({ href, label, icon: Icon, primary }) => (
        <Link
          key={href}
          href={href}
          className={
            primary
              ? 'flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-brand-600'
              : 'flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-lg ring-1 ring-brand-200 transition-colors hover:bg-brand-50'
          }
        >
          <Icon className="h-4 w-4" /> {label}
        </Link>
      ))}
    </div>
  )
}
