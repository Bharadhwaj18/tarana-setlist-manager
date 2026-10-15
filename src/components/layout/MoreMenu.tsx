'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, LogOut, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ACTIVE_SETLIST_COOKIE } from '@/lib/setlist-context'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { ThemePicker } from '@/components/ui/ThemeToggle'
import { WorkspaceAvatar } from '@/components/ui/WorkspaceAvatar'
import { isPersonal, roleLabel, workspaceLabel, type WorkspaceOption } from '@/lib/workspace-options'
import { sectionForHref, type SectionKey } from '@/lib/workspace-sections'

interface Props {
  email: string
  workspaces: WorkspaceOption[]
  currentWorkspaceId: string
  hiddenSections?: SectionKey[]
}

const GROUPS = [
  { label: 'Perform', items: [{ href: '/shows', label: 'Shows' }, { href: '/songs', label: 'Songs' }, { href: '/recordings', label: 'Recordings' }] },
  { label: 'Organise', items: [{ href: '/tasks', label: 'Tasks' }, { href: '/notes', label: 'Notes' }, { href: '/calendar', label: 'Calendar' }, { href: '/event-management', label: 'Agencies' }] },
  { label: 'Account', items: [{ href: '/workspaces', label: 'Workspaces' }, { href: '/workspace', label: 'Workspace & members' }, { href: '/settings', label: 'Settings' }] },
]

export function MoreMenu({ email, workspaces, currentWorkspaceId, hiddenSections = [] }: Props) {
  const groups = GROUPS.map(g => ({ ...g, items: g.items.filter(i => { const sec = sectionForHref(i.href); return !sec || !hiddenSections.includes(sec) }) })).filter(g => g.items.length > 0)
  const router = useRouter()

  const current = workspaces.find(w => w.id === currentWorkspaceId) ?? workspaces[0]

  const signOut = async () => {
    await createClient().auth.signOut()
    router.push('/login')
  }

  // Opening the song library on its own clears which setlist counts as "active" (same rule as the desktop sidebar).
  const onNavigate = (href: string) => {
    if (href === '/songs') {
      // eslint-disable-next-line react-hooks/immutability
      document.cookie = `${ACTIVE_SETLIST_COOKIE}=; path=/; max-age=0`
    }
  }

  return (
    <div className="space-y-5">
      {current && (
        <Link href="/workspaces" className="flex items-center gap-3 rounded-2xl bg-sidebar p-3 text-sidebar-strong">
          {isPersonal(current) ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sidebar-hover"><User className="h-5 w-5" /></span>
          ) : (
            <WorkspaceAvatar name={current.name} color={current.color} avatarUrl={current.avatarUrl} size={44} />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-extrabold">{workspaceLabel(current)}</span>
            <span className="block text-xs text-sidebar-muted">{isPersonal(current) ? 'Just you' : roleLabel(current.role)} · {workspaces.length} {workspaces.length === 1 ? 'workspace' : 'workspaces'}</span>
          </span>
          <span className="text-xs font-bold text-sidebar-muted">Switch &rsaquo;</span>
        </Link>
      )}

      {groups.map(group => (
        <section key={group.label} className="space-y-2">
          <SectionLabel>{group.label}</SectionLabel>
          <div className="overflow-hidden rounded-2xl border border-brand-200 bg-white">
            {group.items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onNavigate(item.href)}
                className="flex items-center justify-between border-b border-brand-100 px-4 py-3.5 font-semibold text-gray-800 last:border-b-0 hover:bg-brand-50"
              >
                {item.label}
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-2">
        <SectionLabel>Appearance</SectionLabel>
        <ThemePicker />
      </section>

      <section className="space-y-2">
        <p className="truncate text-xs text-gray-500">Signed in as {email}</p>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-white px-4 py-3.5 font-semibold text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </section>
    </div>
  )
}
