'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, Trash2 } from 'lucide-react'
import {
  renameWorkspace, createInvite, revokeInvite, setMemberTreasurer, setMemberRole, removeMember, leaveWorkspace,
} from '@/actions/workspace'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export interface MemberRow {
  userId: string
  name: string
  role: string
  treasurer: boolean
  isYou: boolean
}

export interface InviteRow {
  id: string
  token: string
  role: string
  expiresAt: string
  maxUses: number | null
  useCount: number
}

interface Props {
  workspaceName: string
  isAdmin: boolean
  isOwner: boolean
  members: MemberRow[]
  invites: InviteRow[]
}

const card = 'rounded-xl border border-brand-200 bg-white p-5 shadow-sm'
const heading = 'mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400'

export function WorkspaceManager({ workspaceName, isAdmin, isOwner, members, invites }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(workspaceName)
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [days, setDays] = useState(7)
  const [maxUses, setMaxUses] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) => {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (res.error) setError(res.error)
      else {
        after?.()
        router.refresh()
      }
    })
  }

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`)
      setCopied(token)
      setTimeout(() => setCopied(c => (c === token ? null : c)), 2000)
    } catch {
      setError('Couldn’t copy automatically. Use the copy button next to the link.')
    }
  }

  const newInvite = () => {
    const parsedMax = maxUses.trim() ? Number(maxUses) : null
    run(async () => {
      const res = await createInvite({ role: inviteRole, expiresInDays: days, maxUses: parsedMax })
      if (res.token) await copy(res.token)
      return res
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isAdmin && (
        <section className={card}>
          <h2 className={heading}>Workspace name</h2>
          <form
            className="flex gap-2"
            onSubmit={e => { e.preventDefault(); run(() => renameWorkspace(name)) }}
          >
            <Input value={name} maxLength={60} onChange={e => setName(e.target.value)} aria-label="Workspace name" />
            <Button type="submit" variant="secondary" loading={pending} disabled={!name.trim() || name.trim() === workspaceName}>Save</Button>
          </form>
        </section>
      )}

      <section className={card}>
        <h2 className={heading}>Members ({members.length})</h2>
        <ul className="divide-y divide-brand-100">
          {members.map(m => (
            <li key={m.userId} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{m.name}{m.isYou && <span className="ml-1 text-gray-400">(you)</span>}</p>
                <p className="text-xs capitalize text-gray-500">{m.role}{m.treasurer ? ' · Treasurer' : ''}</p>
              </div>
              {isAdmin && m.role !== 'owner' && !m.isYou && (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={m.treasurer}
                      disabled={pending}
                      onChange={e => run(() => setMemberTreasurer(m.userId, e.target.checked))}
                    />
                    Treasurer
                  </label>
                  {isOwner && (
                    <select
                      value={m.role}
                      disabled={pending}
                      aria-label={`Role for ${m.name}`}
                      onChange={e => run(() => setMemberRole(m.userId, e.target.value as 'admin' | 'member'))}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
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
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isAdmin && (
        <section className={card}>
          <h2 className={heading}>Invite people</h2>
          <p className="mb-4 text-sm text-gray-500">Create a link and send it on WhatsApp. Anyone with the link can join until it expires.</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-gray-600">
              Joins as
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'member' | 'admin')} className="mt-1 block rounded-md border border-gray-300 bg-white px-2 py-2 text-sm">
                <option value="member">Member</option>
                {isOwner && <option value="admin">Admin</option>}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Expires in
              <select value={days} onChange={e => setDays(Number(e.target.value))} className="mt-1 block rounded-md border border-gray-300 bg-white px-2 py-2 text-sm">
                {[1, 3, 7, 14, 30].map(d => <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Max people
              <input
                type="number" min={1} inputMode="numeric" placeholder="No limit"
                value={maxUses} onChange={e => setMaxUses(e.target.value)}
                className="mt-1 block w-28 rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
              />
            </label>
            <Button onClick={newInvite} loading={pending}>Create link</Button>
          </div>

          {invites.length > 0 && (
            <ul className="mt-5 space-y-2">
              {invites.map(i => (
                <li key={i.id} className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs text-gray-700">…/invite/{i.token.slice(0, 8)}…</p>
                    <p className="text-xs text-gray-500">
                      {i.role === 'admin' ? 'Admin' : 'Member'} · expires {new Date(i.expiresAt).toLocaleDateString()} · {i.useCount}{i.maxUses ? `/${i.maxUses}` : ''} joined
                    </p>
                  </div>
                  <button type="button" onClick={() => copy(i.token)} className="rounded-md p-1.5 text-gray-500 hover:bg-brand-100" aria-label="Copy invite link">
                    {copied === i.token ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button
                    type="button" disabled={pending} aria-label="Cancel invite link"
                    onClick={() => run(() => revokeInvite(i.id))}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!isOwner && (
        <section className={card}>
          <h2 className={heading}>Leave workspace</h2>
          <p className="mb-3 text-sm text-gray-500">You’ll lose access to {workspaceName}’s songs, setlists and finances. Your personal space stays.</p>
          <Button
            variant="danger" loading={pending}
            onClick={() => { if (window.confirm(`Leave ${workspaceName}?`)) run(() => leaveWorkspace(), () => router.push('/setlists')) }}
          >
            Leave {workspaceName}
          </Button>
        </section>
      )}
    </div>
  )
}
