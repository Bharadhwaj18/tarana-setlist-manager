'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ACTIVE_SETLIST_COOKIE } from '@/lib/setlist-context'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { ThemePicker } from '@/components/ui/ThemeToggle'
import { WorkspaceSwitcher, type WorkspaceOption } from './WorkspaceSwitcher'

interface Props {
  email: string
  workspaces: WorkspaceOption[]
  currentWorkspaceId: string
}

const GROUPS = [
  { label: 'Perform', items: [{ href: '/songs', label: 'Songs' }, { href: '/recordings', label: 'Recordings' }] },
  { label: 'Organise', items: [{ href: '/tasks', label: 'Tasks' }, { href: '/notes', label: 'Notes' }, { href: '/calendar', label: 'Calendar' }, { href: '/event-management', label: 'Agencies' }] },
  { label: 'Account', items: [{ href: '/workspace', label: 'Workspace & members' }, { href: '/settings', label: 'Settings' }] },
]

export function MoreMenu({ email, workspaces, currentWorkspaceId }: Props) {
  const router = useRouter()

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
      {workspaces.length > 0 && (
        <div className="rounded-2xl bg-sidebar pb-3">
          <WorkspaceSwitcher workspaces={workspaces} currentId={currentWorkspaceId} />
        </div>
      )}

      {GROUPS.map(group => (
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
