'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Trash2 } from 'lucide-react'
import { createInvite, revokeInvite } from '@/actions/workspace'
import { Button } from '@/components/ui/Button'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { StatusPill } from '@/components/ui/StatusPill'
import type { InviteRow } from './settings-types'

const fieldCls = 'mt-1 block rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-gray-900'

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso))

export function InvitesSettings({ invites }: { invites: InviteRow[] }) {
  const router = useRouter()
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [days, setDays] = useState(7)
  const [maxUses, setMaxUses] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`)
      setCopied(token)
      setTimeout(() => setCopied(c => (c === token ? null : c)), 2000)
    } catch {
      setError('Couldn’t copy automatically. Open the link list and copy it by hand.')
    }
  }

  const create = () => {
    setError(null)
    const parsedMax = maxUses.trim() ? Number(maxUses) : null
    startTransition(async () => {
      const res = await createInvite({ role, expiresInDays: days, maxUses: parsedMax })
      if (res.error) { setError(res.error); return }
      if (res.token) await copy(res.token)
      router.refresh()
    })
  }

  const revoke = (id: string) => {
    setError(null)
    startTransition(async () => {
      const res = await revokeInvite(id)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
        <SectionLabel>Create an invite link</SectionLabel>
        <p className="mb-4 mt-1 text-sm text-gray-500">Send it on WhatsApp. Anyone with the link can join until it expires or runs out of uses.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-gray-600">
            Joins as
            <select value={role} onChange={e => setRole(e.target.value as 'member' | 'admin')} className={fieldCls}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-600">
            Expires in
            <select value={days} onChange={e => setDays(Number(e.target.value))} className={fieldCls}>
              {[1, 3, 7, 14, 30].map(d => <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-600">
            Max people
            <input type="number" min={1} inputMode="numeric" placeholder="No limit" value={maxUses} onChange={e => setMaxUses(e.target.value)} className={`${fieldCls} w-28`} />
          </label>
          <Button onClick={create} loading={pending}>Create link</Button>
        </div>
      </section>

      <section className="space-y-2">
        <SectionLabel>Active links ({invites.length})</SectionLabel>
        {invites.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-brand-200 px-4 py-8 text-center text-sm text-gray-500">No active links. Create one above.</p>
        ) : (
          <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-sm">
            {invites.map(i => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-gray-700">…/invite/{i.token.slice(0, 8)}…</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                    <StatusPill tone={i.role === 'admin' ? 'amber' : 'gray'}>{i.role === 'admin' ? 'Admin' : 'Member'}</StatusPill>
                    <span>{i.useCount}{i.maxUses ? ` of ${i.maxUses}` : ''} joined</span>
                    <span>· expires {formatDate(i.expiresAt)}</span>
                  </div>
                </div>
                <button type="button" onClick={() => copy(i.token)} aria-label="Copy invite link" className="rounded-lg p-2 text-gray-500 hover:bg-brand-100">
                  {copied === i.token ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
                <button type="button" disabled={pending} onClick={() => revoke(i.id)} aria-label="Revoke invite link" className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
