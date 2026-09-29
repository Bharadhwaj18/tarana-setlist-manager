'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, ChevronsUpDown, Plus, Settings, User as UserIcon, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { switchWorkspace } from '@/actions/workspace'

export interface WorkspaceOption {
  id: string
  name: string
  type: string
}

interface Props {
  workspaces: WorkspaceOption[]
  currentId: string
  onSwitched?: () => void
}

function labelFor(w: WorkspaceOption) {
  return w.type === 'personal' ? 'Personal' : w.name
}

export function WorkspaceSwitcher({ workspaces, currentId, onSwitched }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const current = workspaces.find(w => w.id === currentId) ?? workspaces[0]

  const pick = (id: string) => {
    setOpen(false)
    if (id === currentId) return
    startTransition(async () => {
      const res = await switchWorkspace(id)
      if (!res.error) {
        router.refresh()
        onSwitched?.()
      }
    })
  }

  return (
    <div className="relative px-3 pt-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={pending}
        className="flex w-full items-center gap-2 rounded-lg bg-brand-200/70 px-3 py-2 text-left text-sm font-medium text-gray-900 hover:bg-brand-200 disabled:opacity-60"
      >
        {current.type === 'personal' ? <UserIcon className="h-4 w-4 shrink-0" /> : <Users className="h-4 w-4 shrink-0" />}
        <span className="flex-1 truncate">{labelFor(current)}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-500" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <ul role="listbox" className="absolute inset-x-3 z-50 mt-1 overflow-hidden rounded-lg border border-brand-200 bg-white py-1 shadow-lg">
            {workspaces.map(w => (
              <li key={w.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={w.id === currentId}
                  onClick={() => pick(w.id)}
                  className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-100', w.id === currentId && 'font-semibold')}
                >
                  {w.type === 'personal' ? <UserIcon className="h-4 w-4 shrink-0 text-gray-500" /> : <Users className="h-4 w-4 shrink-0 text-gray-500" />}
                  <span className="flex-1 truncate">{labelFor(w)}</span>
                  {w.id === currentId && <Check className="h-4 w-4 shrink-0" />}
                </button>
              </li>
            ))}
            <li className="mt-1 border-t border-brand-100 pt-1">
              <Link href="/workspace" onClick={() => { setOpen(false); onSwitched?.() }} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-brand-100">
                <Settings className="h-4 w-4 shrink-0 text-gray-500" />
                <span className="flex-1 truncate">{current.type === 'personal' ? 'About this space' : 'Members & invites'}</span>
              </Link>
              <Link href="/workspace/new" onClick={() => { setOpen(false); onSwitched?.() }} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-brand-100">
                <Plus className="h-4 w-4 shrink-0 text-gray-500" />
                <span className="flex-1 truncate">Create a workspace</span>
              </Link>
            </li>
          </ul>
        </>
      )}
    </div>
  )
}
