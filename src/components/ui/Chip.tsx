'use client'

import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

/** Pill-shaped filter button. */
export function Chip({ active, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors',
        active ? 'bg-brand-400 text-white' : 'bg-brand-100 text-gray-700 hover:bg-brand-200',
        className
      )}
      {...props}
    />
  )
}

interface SegmentedTabsProps<T extends string> {
  tabs: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/** Equal-width tab switcher, used for Upcoming / Played / Insights style views. */
export function SegmentedTabs<T extends string>({ tabs, value, onChange, className }: SegmentedTabsProps<T>) {
  return (
    <div role="tablist" className={cn('flex rounded-xl bg-brand-100 p-1', className)}>
      {tabs.map(t => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors',
            value === t.value ? 'bg-brand-400 text-white shadow-sm' : 'text-gray-700 hover:text-gray-900'
          )}
        >
          {t.label}{t.count !== undefined && <span className="ml-1.5 opacity-80">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}
