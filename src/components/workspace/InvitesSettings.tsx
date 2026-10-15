'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, Copy, Link2, Share2, Trash2 } from 'lucide-react'
import { createInvite, revokeInvite } from '@/actions/workspace'
import { Button } from '@/components/ui/Button'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { StatusPill } from '@/components/ui/StatusPill'
import { APP_NAME } from '@/lib/brand'
import { cn } from '@/lib/utils'
import type { SectionLevels } from '@/lib/workspace-sections'
import { SectionAccessGrid, accessSummary, allSections } from './SectionAccessGrid'
import type { InviteRow } from './settings-types'

const fieldCls = 'mt-1 block w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-gray-900'
const label = 'mb-1.5 block text-sm font-bold text-gray-800'

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso))

const linkFor = (token: string) => `${window.location.origin}/invite/${token}`
const isLocal = () => typeof window !== 'undefined' && /^(localhost|127\.|192\.168\.|10\.)/.test(window.location.hostname)

/** The finished link, shown in full so it can always be copied by hand, with one-tap ways to send it. */
function LinkReady({ token, workspaceName, onClose }: { token: string; workspaceName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const url = linkFor(token)
  const message = `Join ${workspaceName} on ${APP_NAME}: ${url}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: select the link in the box so it can be copied by hand.
      ;(document.getElementById(`invite-${token}`) as HTMLInputElement | null)?.select()
    }
  }
  const share = async () => {
    try { await navigator.share({ title: `Join ${workspaceName}`, text: message, url }) } catch { /* cancelled */ }
  }
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <section className="rounded-2xl border-2 border-brand-400 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-extrabold text-gray-900"><Link2 className="h-4 w-4 text-brand-600" /> Your invite link is ready</p>
          <p className="mt-1 text-sm text-gray-500">Send it to the people you want to add. They tap it, sign in, and they’re in.</p>
        </div>
        <button type="button" onClick={onClose} className="text-xs font-bold text-gray-500 hover:underline">Done</button>
      </div>
      <input id={`invite-${token}`} readOnly value={url} onFocus={e => e.target.select()} aria-label="Invite link"
        className="mt-3 w-full rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 font-mono text-xs text-gray-800" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={copy}>{copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy link</>}</Button>
        <Button asChild variant="secondary">
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>
        </Button>
        {canShare && <Button variant="secondary" onClick={share}><Share2 className="h-4 w-4" /> Share…</Button>}
      </div>
      {isLocal() && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          You’re on a test copy of the app ({window.location.host}), so this link only works on this computer. Create invites from the live app to send them to people.
        </p>
      )}
    </section>
  )
}

export function InvitesSettings({ invites, workspaceName }: { invites: InviteRow[]; workspaceName: string }) {
  const router = useRouter()
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [sections, setSections] = useState<SectionLevels>(allSections('edit'))
  const [days, setDays] = useState(7)
  const [maxUses, setMaxUses] = useState('')
  const [readyToken, setReadyToken] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(token))
      setCopied(token)
      setTimeout(() => setCopied(c => (c === token ? null : c)), 2000)
    } catch {
      setReadyToken(token)
    }
  }

  const create = () => {
    setError(null)
    const parsedMax = maxUses.trim() ? Number(maxUses) : null
    startTransition(async () => {
      const res = await createInvite({ role, expiresInDays: days, maxUses: parsedMax, sections: role === 'member' ? sections : undefined })
      if (res.error) { setError(res.error); return }
      if (res.token) setReadyToken(res.token)
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

      {readyToken && <LinkReady token={readyToken} workspaceName={workspaceName} onClose={() => setReadyToken(null)} />}

      <section className="space-y-5 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
        <div>
          <SectionLabel>Invite people</SectionLabel>
          <p className="mt-1 text-sm text-gray-500">Choose what they’ll be able to do, then send them the link. Anyone with the link can join until it expires.</p>
        </div>

        <div>
          <p className={label}>1. They join as</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              { value: 'member', title: 'Member', text: 'Opens only the sections you choose below.' },
              { value: 'admin', title: 'Admin', text: 'Everything, plus inviting people and changing settings.' },
            ] as const).map(o => (
              <button key={o.value} type="button" aria-pressed={role === o.value} onClick={() => setRole(o.value)}
                className={cn('rounded-xl border p-3 text-left transition-colors', role === o.value ? 'border-brand-400 bg-brand-100' : 'border-brand-200 hover:bg-brand-50')}>
                <span className="block text-sm font-bold text-gray-900">{o.title}</span>
                <span className="block text-xs text-gray-500">{o.text}</span>
              </button>
            ))}
          </div>
        </div>

        {role === 'member' && (
          <div>
            <p className={label}>2. What they can open</p>
            <p className="-mt-1 mb-2 text-xs text-gray-500">View lets them see a section. Edit lets them add and change things. You can still change this for each person later in Members.</p>
            <SectionAccessGrid levels={sections} onChange={setSections} disabled={pending} />
          </div>
        )}

        <div>
          <p className={label}>{role === 'member' ? '3.' : '2.'} How long the link works</p>
          <div className="grid max-w-md grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-gray-600">
              Expires in
              <select value={days} onChange={e => setDays(Number(e.target.value))} className={fieldCls}>
                {[1, 3, 7, 14, 30].map(d => <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-gray-600">
              How many people
              <input type="number" min={1} inputMode="numeric" placeholder="No limit" value={maxUses} onChange={e => setMaxUses(e.target.value)} className={fieldCls} />
            </label>
          </div>
        </div>

        <Button onClick={create} loading={pending}><Link2 className="h-4 w-4" /> Create invite link</Button>
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
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                    <StatusPill tone={i.role === 'admin' ? 'amber' : 'gray'}>{i.role === 'admin' ? 'Admin' : 'Member'}</StatusPill>
                    <span className="font-semibold text-gray-700">{i.role !== 'admin' && i.sections ? accessSummary(i.sections) : 'Everything'}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{i.useCount}{i.maxUses ? ` of ${i.maxUses}` : ''} joined · expires {formatDate(i.expiresAt)}</p>
                </div>
                <button type="button" onClick={() => setReadyToken(i.token)} aria-label="Send this link" title="Send" className="rounded-lg p-2 text-gray-500 hover:bg-brand-100">
                  <Share2 className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => copy(i.token)} aria-label="Copy invite link" title="Copy" className="rounded-lg p-2 text-gray-500 hover:bg-brand-100">
                  {copied === i.token ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
                <button type="button" disabled={pending} onClick={() => revoke(i.id)} aria-label="Cancel invite link" title="Cancel link" className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600">
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
