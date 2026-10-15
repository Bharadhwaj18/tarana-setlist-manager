'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, Compass, Plus, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkspaceAvatar } from '@/components/ui/WorkspaceAvatar'
import { todayISO } from '@/lib/shows'
import { attentionBadge, isPersonal, roleLabel, workspaceLabel, type WorkspaceOption } from '@/lib/workspace-options'
import { NotificationBell } from './NotificationBell'
import { useSwitchWorkspace } from './useSwitchWorkspace'
import type { NotificationItem } from '@/types/notifications'

interface Props {
  workspaces: WorkspaceOption[]
  currentId: string
  notifications: NotificationItem[]
}

function Tile({ w, size }: { w: WorkspaceOption; size: number }) {
  if (isPersonal(w)) {
    return (
      <span style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }} className="flex shrink-0 items-center justify-center bg-brand-100 text-gray-700">
        <User style={{ width: size * 0.5, height: size * 0.5 }} />
      </span>
    )
  }
  return <WorkspaceAvatar name={w.name} color={w.color} avatarUrl={w.avatarUrl} size={size} />
}

/** Phone-only header: the current workspace (tap for a bottom sheet to switch) on the left, notifications on the right. */
export function MobileTopBar({ workspaces, currentId, notifications }: Props) {
  const [open, setOpen] = useState(false)
  const { pending, switchTo } = useSwitchWorkspace(() => setOpen(false))
  const current = workspaces.find(w => w.id === currentId) ?? workspaces[0]
  const today = todayISO()

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-brand-200/70 bg-brand-50/90 px-3 backdrop-blur lg:hidden">
        {current ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="flex min-w-0 items-center gap-2 rounded-full border border-brand-200 bg-white py-1 pl-1 pr-3 text-left shadow-sm"
          >
            <Tile w={current} size={32} />
            <span className="truncate text-sm font-bold text-gray-900">{workspaceLabel(current)}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          </button>
        ) : <span />}

        <NotificationBell notifications={notifications} tone="page" />
      </header>

      <div className={cn('fixed inset-0 z-50 lg:hidden', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
        <div
          className={cn('absolute inset-0 bg-black/40 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
          onClick={() => setOpen(false)}
        />
        <div
          role="dialog"
          aria-label="Switch workspace"
          className={cn(
            'absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 shadow-2xl transition-transform duration-300 ease-out',
            open ? 'translate-y-0' : 'translate-y-full'
          )}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 className="font-display text-xl font-bold text-gray-900">Switch workspace</h2>
            <span className="text-xs font-bold text-gray-500">{workspaces.length} total</span>
          </div>

          <ul className={cn('space-y-1.5', pending && 'opacity-70')}>
            {workspaces.map(w => {
              const isCurrent = w.id === currentId
              const badge = attentionBadge(w, today)
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => switchTo(w.id, currentId)}
                    className={cn('flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left', isCurrent ? 'border-brand-300 bg-brand-100' : 'border-transparent hover:bg-brand-50')}
                  >
                    <Tile w={w} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-extrabold text-gray-900">{workspaceLabel(w)}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {isPersonal(w)
                          ? <span className="text-xs text-gray-500">Just you · all calendars</span>
                          : <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">{roleLabel(w.role)}</span>}
                        {badge && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{badge}</span>}
                      </span>
                    </span>
                    {isCurrent && <Check className="h-5 w-5 shrink-0 text-brand-600" />}
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="/workspace/new" onClick={() => setOpen(false)} className="flex items-center justify-center gap-2 rounded-2xl bg-brand-400 px-4 py-3 text-sm font-extrabold text-white">
              <Plus className="h-4 w-4" /> Create
            </Link>
            <Link href="/choose-workspace#join" onClick={() => setOpen(false)} className="flex items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-white px-4 py-3 text-sm font-extrabold text-gray-800">
              <Compass className="h-4 w-4" /> Join with a link
            </Link>
          </div>
          <Link href="/choose-workspace" onClick={() => setOpen(false)} className="mt-3 block text-center text-sm font-bold text-brand-700">
            Manage workspaces &rarr;
          </Link>
        </div>
      </div>
    </>
  )
}
