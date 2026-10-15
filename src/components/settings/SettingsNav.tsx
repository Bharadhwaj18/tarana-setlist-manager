'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, ChevronRight, KeyRound, Link2, LogOut, Sun, SquarePen, User, Users, Wallet, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SettingsIcon, SettingsItem } from '@/lib/settings-sections'
import { WorkspacePill } from './WorkspacePill'
import type { WorkspaceOption } from '@/lib/workspace-options'

export const SETTINGS_ICONS: Record<SettingsIcon, LucideIcon> = {
  profile: User,
  signin: KeyRound,
  appearance: Sun,
  notifications: Bell,
  general: SquarePen,
  members: Users,
  invites: Link2,
  money: Wallet,
  leave: LogOut,
}

const heading = 'text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-500'

/** Desktop: the two sections down the left side, the open page highlighted. */
export function SettingsNav({ items, workspaces, currentId }: { items: SettingsItem[]; workspaces: WorkspaceOption[]; currentId: string }) {
  const pathname = usePathname()
  const active = (href: string) => pathname === href || (pathname === '/settings' && href === '/settings/profile')
  const link = (it: SettingsItem) => {
    const Icon = SETTINGS_ICONS[it.key]
    const on = active(it.href)
    return (
      <Link key={it.href} href={it.href} aria-current={on ? 'page' : undefined}
        className={cn('flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm transition-colors',
          on ? 'bg-brand-400 font-extrabold text-white' : it.danger ? 'font-bold text-red-700 hover:bg-red-50' : 'font-bold text-gray-700 hover:bg-brand-100')}>
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1">{it.label}</span>
      </Link>
    )
  }
  return (
    <nav aria-label="Settings" className="sticky top-8 flex flex-col gap-1">
      <p className={cn(heading, 'mb-1 ml-3')}>You</p>
      {items.filter(i => i.section === 'you').map(link)}
      <div className="mb-1.5 ml-3 mt-5 flex flex-col items-start gap-2">
        <p className={heading}>This workspace</p>
        <WorkspacePill workspaces={workspaces} currentId={currentId} />
      </div>
      {items.filter(i => i.section === 'workspace').map(link)}
    </nav>
  )
}

/** Phone: one scrolling list, two sections, a row per page. */
export function SettingsList({ items, workspaces, currentId, footnote }: { items: SettingsItem[]; workspaces: WorkspaceOption[]; currentId: string; footnote?: string }) {
  const row = (it: SettingsItem, last: boolean) => {
    const Icon = SETTINGS_ICONS[it.key]
    return (
      <Link key={it.href} href={it.href}
        className={cn('flex min-h-14 items-center gap-3 px-3.5 active:bg-brand-50', !last && 'border-b border-brand-100', it.danger ? 'text-red-700' : 'text-gray-900')}>
        <span className={cn('flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]', it.danger ? 'bg-red-50 text-red-700' : 'bg-brand-100 text-brand-600')}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1 text-[15px] font-bold">{it.label}</span>
        {it.pill && <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-extrabold text-gray-600">{it.pill}</span>}
        {it.hint && <span className="max-w-[9.5rem] shrink-0 truncate text-[13px] font-semibold text-gray-500">{it.hint}</span>}
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
      </Link>
    )
  }
  const group = (list: SettingsItem[]) => (
    <div className="overflow-hidden rounded-2xl border border-brand-200 bg-white">{list.map((it, i) => row(it, i === list.length - 1))}</div>
  )
  const you = items.filter(i => i.section === 'you')
  const ws = items.filter(i => i.section === 'workspace')
  return (
    <div className="space-y-3">
      <p className={cn(heading, 'px-1 pt-1')}>You</p>
      {group(you)}
      <div className="flex items-center justify-between gap-3 px-1 pt-3">
        <p className={heading}>This workspace</p>
        <WorkspacePill workspaces={workspaces} currentId={currentId} />
      </div>
      {ws.length > 0 && group(ws)}
      {footnote && <p className="px-1 text-xs leading-relaxed text-gray-500">{footnote}</p>}
    </div>
  )
}
