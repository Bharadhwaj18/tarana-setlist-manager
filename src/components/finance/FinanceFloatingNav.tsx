import Link from 'next/link'
import { History, ArrowRightLeft } from 'lucide-react'

/**
 * Persistent bottom-right destinations — History and Split are places you
 * go look at, not things you do on this page, so they stay reachable from
 * anywhere in Finance without cluttering the top action row.
 */
export function FinanceFloatingNav({ hasUnsplitShows }: { hasUnsplitShows: boolean }) {
  return (
    <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-2">
      {hasUnsplitShows && (
        <Link
          href="/finance/split"
          className="flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-brand-600"
        >
          <ArrowRightLeft className="h-4 w-4" /> Split
        </Link>
      )}
      <Link
        href="/finance/history"
        className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-lg ring-1 ring-brand-200 transition-colors hover:bg-brand-50"
      >
        <History className="h-4 w-4" /> History
      </Link>
    </div>
  )
}
