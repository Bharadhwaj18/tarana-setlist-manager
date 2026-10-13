'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, CalendarDays, Copy, Music2, UserPlus } from 'lucide-react'
import { createWorkspace, createInvite } from '@/actions/workspace'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Chip } from '@/components/ui/Chip'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { WorkspaceAvatar } from '@/components/ui/WorkspaceAvatar'
import { DEFAULT_WORKSPACE_TONE, type WorkspaceTone } from '@/lib/workspace-tones'
import { WORKSPACE_KINDS } from './constants'
import { ToneSwatches } from './ToneSwatches'

export function CreateWorkspaceForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<string>('Band')
  const [tone, setTone] = useState<WorkspaceTone>(DEFAULT_WORKSPACE_TONE)
  const [inviteNow, setInviteNow] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ name: string; inviteUrl: string | null } | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  const submit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await createWorkspace({ name, kind, color: tone })
      if (res.error) {
        setError(res.error)
        return
      }
      let inviteUrl: string | null = null
      if (inviteNow) {
        const invite = await createInvite({ role: 'member', expiresInDays: 7, maxUses: null })
        if (invite.token) inviteUrl = `${window.location.origin}/invite/${invite.token}`
      }
      setCreated({ name: name.trim(), inviteUrl })
      router.refresh()
    })
  }

  const copy = async () => {
    if (!created?.inviteUrl) return
    try {
      await navigator.clipboard.writeText(created.inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Couldn’t copy automatically. Select the link and copy it by hand.')
    }
  }

  if (created) {
    const steps = [
      { href: '/shows/new', icon: CalendarDays, title: 'Add your next event', hint: 'Date, venue and fee in one place' },
      { href: '/songs/new', icon: Music2, title: 'Add a few songs', hint: 'Chord charts and setlists build on these' },
      { href: '/workspace?tab=invites', icon: UserPlus, title: 'Invite the rest of the workspace', hint: 'Send a link on WhatsApp' },
    ]
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <WorkspaceAvatar name={created.name} color={tone} size="lg" />
          <div className="min-w-0">
            <SectionLabel>You’re set up</SectionLabel>
            <h2 className="truncate font-display text-2xl font-bold text-gray-900">{created.name}</h2>
          </div>
        </div>

        {created.inviteUrl && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
            <p className="mb-2 text-xs font-semibold text-gray-600">Invite link (works for 7 days)</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-white px-2.5 py-2 text-xs text-gray-700">{created.inviteUrl}</code>
              <Button type="button" size="sm" variant="secondary" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        )}

        <ol className="space-y-2">
          {steps.map(({ href, icon: Icon, title, hint }, i) => (
            <li key={href}>
              <Link href={href} className="flex items-center gap-3 rounded-xl border border-brand-200 bg-white p-3 transition-colors hover:bg-brand-50">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-gray-900">{i + 1}. {title}</span>
                  <span className="block text-xs text-gray-500">{hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <Button type="button" onClick={() => router.push('/')}>Go to Today</Button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-center gap-4">
        <WorkspaceAvatar name={name || 'W'} color={tone} size="xl" />
        <div className="min-w-0 flex-1">
          <label htmlFor="workspace-name" className="mb-1.5 block text-sm font-bold text-gray-800">Workspace name</label>
          <Input id="workspace-name" autoFocus maxLength={60} placeholder="e.g. The Local Train, Studio 9, Sunday Jam" value={name} onChange={e => setName(e.target.value)} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-gray-800">What is it for?</p>
        <div className="flex flex-wrap gap-2">
          {WORKSPACE_KINDS.map(k => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{k}</Chip>)}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-gray-800">Colour</p>
        <ToneSwatches value={tone} onChange={setTone} />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3">
        <input type="checkbox" checked={inviteNow} onChange={e => setInviteNow(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-400" />
        <span>
          <span className="block text-sm font-bold text-gray-900">Create an invite link now</span>
          <span className="block text-xs text-gray-500">A 7-day link for people to join as members. You can make more later.</span>
        </span>
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" loading={pending} disabled={!name.trim()}>Create workspace</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()} disabled={pending}>Cancel</Button>
      </div>
    </form>
  )
}
