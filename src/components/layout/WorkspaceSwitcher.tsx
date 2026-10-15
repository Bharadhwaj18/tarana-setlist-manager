'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronsUpDown, Plus, Search, Compass, Settings, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkspaceAvatar } from '@/components/ui/WorkspaceAvatar'
import { todayISO } from '@/lib/shows'
import { attentionBadge, isPersonal, roleLabel, workspaceLabel, workspaceSubtitle, type WorkspaceOption } from '@/lib/workspace-options'
import { useSwitchWorkspace } from './useSwitchWorkspace'

export type { WorkspaceOption } from '@/lib/workspace-options'

interface Props {
  workspaces: WorkspaceOption[]
  currentId: string
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

/** Sidebar workspace card. Opens a searchable list; Ctrl/Cmd+K opens it from anywhere and 1-9 jump straight to a workspace. */
export function WorkspaceSwitcher({ workspaces, currentId }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const close = () => { setOpen(false); setQuery(''); setActive(0) }
  const { pending, switchTo } = useSwitchWorkspace(close)
  const current = workspaces.find(w => w.id === currentId) ?? workspaces[0]
  const today = todayISO()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? workspaces.filter(w => `${workspaceLabel(w)} ${w.kind ?? ''}`.toLowerCase().includes(q)) : workspaces
  }, [workspaces, query])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(v => !v)
        setQuery('')
        setActive(0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  if (!current) return null

  const pick = (w: WorkspaceOption) => switchTo(w.id, currentId)

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { close(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const w = filtered[active]; if (w) pick(w) }
    else if (query === '' && /^[1-9]$/.test(e.key)) {
      const w = workspaces[Number(e.key) - 1]
      if (w) { e.preventDefault(); pick(w) }
    }
  }

  return (
    <div className="relative px-3 pt-3">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={pending}
        className="flex w-full items-center gap-2.5 rounded-xl bg-sidebar-hover px-2.5 py-2 text-left text-sidebar-strong transition-colors hover:bg-sidebar-border disabled:opacity-60"
      >
        <Tile w={current} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{workspaceLabel(current)}</span>
          <span className="block truncate text-[11px] font-medium text-sidebar-muted">
            {isPersonal(current) ? 'Just you' : `${current.kind || 'Workspace'} · ${roleLabel(current.role)}`}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-muted" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div role="dialog" aria-label="Switch workspace" className="absolute left-3 top-full z-50 mt-1.5 w-[22rem] overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-brand-100 px-3.5 py-3">
              <Search className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setActive(0) }}
                onKeyDown={onSearchKey}
                placeholder="Jump to a workspace…"
                aria-label="Search workspaces"
                className="compact-field min-w-0 flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
              />
              <kbd className="rounded-md border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">Ctrl K</kbd>
            </div>

            <ul role="listbox" className="max-h-80 overflow-y-auto p-1.5">
              {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-gray-500">No workspace matches &ldquo;{query}&rdquo;.</li>}
              {filtered.map((w, i) => {
                const isCurrent = w.id === currentId
                const badge = attentionBadge(w, today)
                const shortcut = workspaces.indexOf(w) + 1
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isCurrent}
                      onClick={() => pick(w)}
                      onMouseEnter={() => setActive(i)}
                      className={cn('flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left', i === active ? 'bg-brand-100' : 'hover:bg-brand-50')}
                    >
                      <Tile w={w} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className={cn('truncate text-sm text-gray-900', isCurrent ? 'font-extrabold' : 'font-bold')}>{workspaceLabel(w)}</span>
                          {!isPersonal(w) && <span className="shrink-0 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">{roleLabel(w.role)}</span>}
                          {badge && <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">{badge}</span>}
                        </span>
                        <span className="block truncate text-xs text-gray-500">{workspaceSubtitle(w)}</span>
                      </span>
                      {isCurrent && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                      {query === '' && shortcut <= 9 && (
                        <span className="w-4 shrink-0 text-center text-[11px] font-bold text-gray-400">{shortcut}</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="space-y-0.5 border-t border-brand-100 p-1.5">
              <Link href="/workspace/new" onClick={close} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-gray-800 hover:bg-brand-50">
                <Plus className="h-4 w-4 text-gray-400" /> Create a workspace
              </Link>
              <Link href="/choose-workspace#join" onClick={close} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-gray-800 hover:bg-brand-50">
                <Compass className="h-4 w-4 text-gray-400" /> Join with a link
              </Link>
              <Link href="/settings/workspace" onClick={close} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-gray-800 hover:bg-brand-50">
                <Settings className="h-4 w-4 text-gray-400" />
                <span className="min-w-0 flex-1 truncate">{isPersonal(current) ? 'About your personal space' : `Workspace settings for ${current.name}`}</span>
              </Link>
              <Link href="/choose-workspace" onClick={close} className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50">
                Manage workspaces <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>

            {workspaces.length > 1 && (
              <p className="border-t border-brand-100 bg-brand-50 px-3.5 py-2 text-[11px] text-gray-500">
                Press <b className="text-gray-700">1</b> to <b className="text-gray-700">{Math.min(workspaces.length, 9)}</b> to switch
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
