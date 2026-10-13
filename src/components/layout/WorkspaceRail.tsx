'use client'

import Link from 'next/link'
import { Compass, Plus, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkspaceAvatar } from '@/components/ui/WorkspaceAvatar'
import { isPersonal, roleLabel, workspaceLabel, type WorkspaceOption } from '@/lib/workspace-options'
import { useSwitchWorkspace } from './useSwitchWorkspace'

interface Props {
  workspaces: WorkspaceOption[]
  currentId: string
}

/** Far-left strip on desktop: every workspace one click away, Slack-style. */
export function WorkspaceRail({ workspaces, currentId }: Props) {
  const { pending, switchTo } = useSwitchWorkspace()
  if (workspaces.length === 0) return null

  return (
    <nav
      aria-label="Workspaces"
      className="hidden w-16 shrink-0 flex-col items-center gap-2 border-r border-sidebar-border bg-[color-mix(in_oklab,var(--color-sidebar)_72%,black)] py-3 lg:flex"
    >
      <div className={cn('flex w-full flex-1 flex-col items-center gap-2', pending && 'opacity-70')}>
        {workspaces.map((w, i) => {
          const current = w.id === currentId
          const showDivider = i === 0 && isPersonal(w) && workspaces.length > 1
          return (
            <div key={w.id} className="flex w-full flex-col items-center gap-2">
              <div className="group relative flex w-full justify-center">
                {current && <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-strong" aria-hidden="true" />}
                <button
                  type="button"
                  onClick={() => switchTo(w.id, currentId)}
                  aria-label={`Switch to ${workspaceLabel(w)}`}
                  aria-current={current ? 'true' : undefined}
                  className={cn('relative rounded-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-strong', current && 'ring-2 ring-sidebar-accent ring-offset-2 ring-offset-sidebar')}
                >
                  {isPersonal(w) ? (
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar-hover text-sidebar-strong">
                      <User className="h-5 w-5" />
                    </span>
                  ) : (
                    <WorkspaceAvatar name={w.name} color={w.color} avatarUrl={w.avatarUrl} size={44} />
                  )}
                  {w.tasksDue > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sidebar-accent px-1 text-[10px] font-extrabold text-sidebar-active-fg ring-2 ring-sidebar">
                      {w.tasksDue}
                    </span>
                  ) : null}
                </button>
                <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-900 shadow-lg group-hover:block group-focus-within:block">
                  {workspaceLabel(w)} <span className="font-medium text-gray-500">· {isPersonal(w) ? 'Just you' : roleLabel(w.role)}</span>
                </span>
              </div>
              {showDivider && <span className="h-px w-7 bg-sidebar-border" aria-hidden="true" />}
            </div>
          )
        })}
      </div>

      <div className="flex flex-col items-center gap-2">
        <Link
          href="/workspace/new"
          aria-label="Create a workspace"
          title="Create a workspace"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-sidebar-muted text-sidebar-muted transition-colors hover:border-sidebar-strong hover:text-sidebar-strong"
        >
          <Plus className="h-5 w-5" />
        </Link>
        <Link
          href="/workspaces#join"
          aria-label="Join with an invite link"
          title="Join with an invite link"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-strong"
        >
          <Compass className="h-5 w-5" />
        </Link>
      </div>
    </nav>
  )
}
