'use client'

import { cn } from '@/lib/utils'
import type { Member } from '@/types/tasks'

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      title={name}
      className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-200 text-[10px] font-semibold text-brand-800 ring-2 ring-white', className)}
    >
      {initials(name)}
    </span>
  )
}

interface Props {
  members: Member[]
  value: string[]
  onChange: (ids: string[]) => void
}

/** Toggleable member chips: tap a name to assign or unassign. */
export function AssigneePicker({ members, value, onChange }: Props) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id])
  if (!members.length) return <p className="text-xs text-gray-400">No other members yet.</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {members.map(m => {
        const on = value.includes(m.id)
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => toggle(m.id)}
            aria-pressed={on}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs transition-colors',
              on ? 'border-brand-500 bg-brand-100 text-brand-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
            )}
          >
            <Avatar name={m.name} className="ring-0" />
            {m.name}
          </button>
        )
      })}
    </div>
  )
}
