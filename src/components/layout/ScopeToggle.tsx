import Link from 'next/link'
import { cn } from '@/lib/utils'

const tab = 'rounded-lg px-3 py-1.5 text-xs font-extrabold transition-colors'

/** "This one | All workspaces" switch for pages that can also look across every workspace (Personal opens on All). */
export function ScopeToggle({ all, thisHref, allHref }: { all: boolean; thisHref: string; allHref: string }) {
  return (
    <div className="flex shrink-0 rounded-xl bg-brand-100 p-1">
      <Link href={thisHref} className={cn(tab, !all ? 'bg-brand-400 text-white' : 'text-gray-700 hover:text-gray-900')}>
        <span className="md:hidden">This one</span><span className="hidden md:inline">This workspace</span>
      </Link>
      <Link href={allHref} className={cn(tab, all ? 'bg-brand-400 text-white' : 'text-gray-700 hover:text-gray-900')}>
        <span className="md:hidden">All</span><span className="hidden md:inline">All workspaces</span>
      </Link>
    </div>
  )
}
