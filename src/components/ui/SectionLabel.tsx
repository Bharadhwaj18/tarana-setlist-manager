import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Small uppercase label that titles a group of rows or a card. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn('font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-gray-500', className)}>
      {children}
    </h2>
  )
}
