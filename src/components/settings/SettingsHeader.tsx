import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

/** Top of every Settings page: a way back to the list on phones, then what this page is. */
export function SettingsHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <Link href="/settings" className="mb-3 inline-flex min-h-8 items-center gap-0.5 text-sm font-bold text-gray-500 hover:text-gray-800 lg:hidden">
        <ChevronLeft className="h-4 w-4" /> Settings
      </Link>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-500">{eyebrow}</p>}
          <h1 className="truncate font-display text-3xl font-bold text-gray-900">{title}</h1>
        </div>
        {action}
      </div>
    </div>
  )
}
