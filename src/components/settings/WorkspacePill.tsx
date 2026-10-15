'use client'

import { useState } from 'react'
import { Check, ChevronDown, User } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { WorkspaceAvatar } from '@/components/ui/WorkspaceAvatar'
import { isPersonal, roleLabel, workspaceLabel, type WorkspaceOption } from '@/lib/workspace-options'
import { cn } from '@/lib/utils'
import { useSwitchWorkspace } from '@/components/layout/useSwitchWorkspace'

function Tile({ w, size }: { w: WorkspaceOption; size: number }) {
  if (isPersonal(w)) {
    return <span style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }} className="flex shrink-0 items-center justify-center bg-brand-100 text-gray-700"><User style={{ width: size * 0.55, height: size * 0.55 }} /></span>
  }
  return <WorkspaceAvatar name={w.name} color={w.color} avatarUrl={w.avatarUrl} size={size} />
}

/**
 * Which workspace these settings are for. Picking another one switches to it and stays on the same
 * Settings page, so you can go from one workspace's members to the next without leaving Settings.
 */
export function WorkspacePill({ workspaces, currentId }: { workspaces: WorkspaceOption[]; currentId: string }) {
  const [open, setOpen] = useState(false)
  const { pending, switchTo } = useSwitchWorkspace(() => setOpen(false))
  const current = workspaces.find(w => w.id === currentId)
  if (!current) return null

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Settings for ${workspaceLabel(current)}. Change workspace`}
        className="inline-flex max-w-[60vw] items-center gap-1.5 rounded-full border border-brand-200 bg-white py-1 pl-1 pr-2.5 text-xs font-extrabold text-gray-900 shadow-sm hover:bg-brand-50 lg:max-w-[13rem]">
        <Tile w={current} size={20} />
        <span className="truncate">{workspaceLabel(current)}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      </button>

      <Modal open={open} onOpenChange={setOpen} title="Settings for"
        description="Switches you to that workspace and keeps you on this page."
        className="max-w-md max-sm:top-auto max-sm:bottom-0 max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-3xl">
        <ul className={cn('mt-4 space-y-1', pending && 'opacity-60')}>
          {workspaces.map(w => {
            const on = w.id === currentId
            return (
              <li key={w.id}>
                <button type="button" disabled={pending} onClick={() => switchTo(w.id, currentId)}
                  className={cn('flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left', on ? 'bg-brand-100' : 'hover:bg-brand-50')}>
                  <Tile w={w} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-extrabold text-gray-900">{workspaceLabel(w)}</span>
                    <span className="block text-xs text-gray-500">{isPersonal(w) ? 'Just you' : [w.kind, roleLabel(w.role)].filter(Boolean).join(' · ')}</span>
                  </span>
                  {on && <Check className="h-5 w-5 shrink-0 text-brand-600" />}
                </button>
              </li>
            )
          })}
        </ul>
      </Modal>
    </>
  )
}
