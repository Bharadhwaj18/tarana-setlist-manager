'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Link2, Trash2, UserPlus } from 'lucide-react'
import { setMemberRole, setMemberTreasurer, removeMember } from '@/actions/workspace'
import { StatusPill } from '@/components/ui/StatusPill'
import { cn } from '@/lib/utils'
import type { MemberRow } from './settings-types'

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' }

function Initial({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-base font-bold text-brand-700">
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

interface Props {
  workspaceName: string
  members: MemberRow[]
  isAdmin: boolean
  isOwner: boolean
  activeInviteCount: number
}

export function MembersSettings({ workspaceName, members, isAdmin, isOwner, activeInviteCount }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const run = (fn: () => Promise<{ error?: string }>) => {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">{members.length} {members.length === 1 ? 'member' : 'members'}</p>
        {isAdmin && (
          <Link href="/workspace?tab=invites" className="inline-flex items-center gap-2 rounded-lg bg-brand-400 px-3.5 py-2 text-sm font-bold text-white hover:bg-brand-500">
            <UserPlus className="h-4 w-4" /> Invite people
          </Link>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-sm">
        {members.map(m => {
          const manageable = isAdmin && m.role !== 'owner' && !m.isYou
          return (
            <li key={m.userId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <Initial name={m.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900">
                  {m.name}{m.isYou && <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-brand-700">You</span>}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  <StatusPill tone={m.role === 'member' ? 'gray' : 'green'}>{ROLE_LABEL[m.role] ?? m.role}</StatusPill>
                  {m.treasurer && <StatusPill tone="amber">Treasurer</StatusPill>}
                </div>
              </div>

              {manageable && (
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-gray-600">
                    <input type="checkbox" checked={m.treasurer} disabled={pending} onChange={e => run(() => setMemberTreasurer(m.userId, e.target.checked))} className="h-4 w-4 accent-brand-400" />
                    Treasurer
                  </label>
                  {isOwner && (
                    <select
                      value={m.role}
                      disabled={pending}
                      aria-label={`Role for ${m.name}`}
                      onChange={e => run(() => setMemberRole(m.userId, e.target.value as 'admin' | 'member'))}
                      className="rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-xs font-bold text-gray-700"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Remove ${m.name}`}
                    onClick={() => { if (window.confirm(`Remove ${m.name} from ${workspaceName}?`)) run(() => removeMember(m.userId)) }}
                    className={cn('rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {isAdmin && activeInviteCount > 0 && (
        <Link href="/workspace?tab=invites" className="flex items-center gap-3 rounded-2xl border border-dashed border-brand-200 bg-white px-4 py-3 text-sm text-gray-600 hover:bg-brand-50">
          <Link2 className="h-4 w-4 text-gray-400" />
          <span className="flex-1">{activeInviteCount} active invite {activeInviteCount === 1 ? 'link' : 'links'}</span>
          <span className="font-bold text-brand-600">Manage</span>
        </Link>
      )}
    </div>
  )
}
