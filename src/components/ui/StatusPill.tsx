import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type PillTone = 'green' | 'amber' | 'red' | 'gray'

const TONES: Record<PillTone, string> = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-700',
}

/** Compact status / key / format tag. */
export function StatusPill({ tone = 'gray', children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold', TONES[tone], className)}>
      {children}
    </span>
  )
}
