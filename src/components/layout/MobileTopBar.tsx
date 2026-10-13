'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Plus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { switchWorkspace } from '@/actions/workspace'
import { NotificationBell } from './NotificationBell'
import type { WorkspaceOption } from './WorkspaceSwitcher'
import type { NotificationItem } from '@/types/notifications'

interface Props {
  workspaces: WorkspaceOption[]
  currentId: string
  notifications: NotificationItem[]
}

const labelFor = (w: WorkspaceOption) => (w.type === 'personal' ? 'Personal' : w.name)

/** Phone-only header: which workspace you're in (tap to switch) on the left, notifications on the right. */
export function MobileTopBar({ workspaces, currentId, notifications }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const current = workspaces.find(w => w.id === currentId) ?? workspaces[0]

  const pick = (id: string) => {
    setOpen(false)
    if (id === currentId) return
    startTransition(async () => {
      const res = await switchWorkspace(id)
      if (!res.error) router.refresh()
    })
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-brand-200/70 bg-brand-50/90 px-3 backdrop-blur lg:hidden">
      {current ? (
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={pending}
          className="flex min-w-0 items-center gap-2 rounded-full border border-brand-200 bg-white py-1 pl-1 pr-3 text-left shadow-sm disabled:opacity-60"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hero font-display text-sm font-bold text-hero-fg">
            {labelFor(current).charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-sm font-bold text-gray-900">{labelFor(current)}</span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
        </button>
      ) : <span />}

      <NotificationBell notifications={notifications} tone="page" />

      {open && (
        <>
          <div className="fixed inset-0 top-14 z-40 bg-black/30" onClick={() => setOpen(false)} />
          <ul role="listbox" className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-brand-200 bg-white py-1 shadow-xl">
            {workspaces.map(w => (
              <li key={w.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={w.id === currentId}
                  onClick={() => pick(w.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-brand-100"
                >
                  <Users className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className={cn('flex-1 truncate', w.id === currentId ? 'font-bold text-gray-900' : 'font-medium text-gray-700')}>{labelFor(w)}</span>
                  {w.id === currentId && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                </button>
              </li>
            ))}
            <li className="mt-1 border-t border-brand-100 pt-1">
              <Link href="/workspace/new" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-brand-100">
                <Plus className="h-4 w-4 shrink-0 text-gray-400" /> Create a workspace
              </Link>
            </li>
          </ul>
        </>
      )}
    </header>
  )
}
