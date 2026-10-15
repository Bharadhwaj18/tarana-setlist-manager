'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, CalendarDays, CheckSquare, Link2, Plus, Search, Settings, User, Users } from 'lucide-react'
import { switchWorkspace } from '@/actions/workspace'
import { WorkspaceAvatar } from '@/components/ui/WorkspaceAvatar'
import { Spinner } from '@/components/ui/Spinner'
import { attentionBadge, formatShortDate, isPersonal, roleLabel, type WorkspaceOption } from '@/lib/workspace-options'
import { WORKSPACE_TONES, normaliseTone } from '@/lib/workspace-tones'
import { parseInviteToken } from '@/lib/invite-link'
import { cn } from '@/lib/utils'

interface Props {
  options: WorkspaceOption[]
  lastUsedId: string
  today: string
  next: string
}

/** Opens that workspace's settings. Sits over the card's bottom-right corner, outside the card's own button. */
function SettingsButton({ name, onClick, disabled }: { name: string; onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={`Settings for ${name}`} title="Settings"
      className="absolute bottom-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-brand-100 hover:text-gray-900 disabled:opacity-50">
      <Settings className="h-[18px] w-[18px]" />
    </button>
  )
}

function Fact({ icon: Icon, children, warn }: { icon: typeof Users; children: React.ReactNode; warn?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', warn ? 'font-bold text-amber-700' : 'text-gray-500')}>
      <Icon className="h-3.5 w-3.5 shrink-0" /> {children}
    </span>
  )
}

/** The first screen after signing in: pick where to work, then everything else follows. */
export function WorkspacePicker({ options, lastUsedId, today, next }: Props) {
  const router = useRouter()
  const [opening, setOpening] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [invite, setInvite] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const inviteRef = useRef<HTMLInputElement>(null)

  // Links like "Join with a link" land here as /choose-workspace#join.
  useEffect(() => {
    if (window.location.hash === '#join') inviteRef.current?.focus()
  }, [])

  const open = (id: string, goTo: string = next) => {
    setOpening(id)
    startTransition(async () => {
      const res = await switchWorkspace(id)
      if (res.error) { setOpening(null); return }
      router.push(goTo)
      router.refresh()
    })
  }

  const joinWithLink = (e: React.FormEvent) => {
    e.preventDefault()
    const token = parseInviteToken(invite)
    if (!token) { setInviteError('Paste the whole invite link you were sent.'); return }
    router.push(`/invite/${token}`)
  }

  const q = query.trim().toLowerCase()
  const shared = options
    .filter(o => !isPersonal(o) && (!q || o.name.toLowerCase().includes(q) || (o.kind ?? '').toLowerCase().includes(q)))
    // The one used last comes first; the rest keep their order.
    .sort((a, b) => Number(b.id === lastUsedId) - Number(a.id === lastUsedId))
  const personal = options.find(isPersonal)
  // Big cards read best for a handful; past that, smaller cards keep everything on one screen.
  const compact = options.filter(o => !isPersonal(o)).length > 4

  return (
    <div className="space-y-6">
      {options.length > 6 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a workspace" aria-label="Find a workspace"
            className="w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400" />
        </div>
      )}

      <div className={cn('grid', compact ? 'grid-cols-2 gap-3 lg:grid-cols-4' : 'gap-4 sm:grid-cols-2 lg:grid-cols-3')}>
        {compact && shared.map(w => (
          <div key={w.id} className="relative">
          <button type="button" onClick={() => open(w.id)} disabled={!!opening}
            className={cn(
              'group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-wait',
              w.id === lastUsedId ? 'border-brand-400' : 'border-brand-200',
              opening && opening !== w.id && 'opacity-60'
            )}>
            <span className={cn('block h-1.5', WORKSPACE_TONES[normaliseTone(w.color)].tile)} />
            <span className="flex flex-1 flex-col gap-2.5 p-4">
              <span className="flex items-center gap-3">
                <WorkspaceAvatar name={w.name} color={w.color} avatarUrl={w.avatarUrl} size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-base font-bold text-gray-900">{w.name}</span>
                  <span className="block truncate text-xs text-gray-500">{[w.kind, roleLabel(w.role)].filter(Boolean).join(' · ')}</span>
                </span>
              </span>
              <span className="flex flex-col gap-1">
                <Fact icon={CalendarDays}>{w.nextShowDate ? `Next ${formatShortDate(w.nextShowDate)}` : 'Nothing booked'}</Fact>
                {w.tasksDue > 0 ? <Fact icon={CheckSquare} warn>{w.tasksDue} task{w.tasksDue === 1 ? '' : 's'} due</Fact> : <Fact icon={Users}>{w.memberCount} {w.memberCount === 1 ? 'member' : 'members'}</Fact>}
              </span>
              <span className="mt-auto flex items-center justify-between text-sm font-bold text-brand-600">
                {opening === w.id ? <span className="inline-flex items-center gap-1"><Spinner className="h-4 w-4" /> Opening…</span> : <span className="inline-flex items-center gap-1">Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>}
                {w.id === lastUsedId && <span className="mr-10 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gray-700">Last used</span>}
              </span>
            </span>
          </button>
          <SettingsButton name={w.name} disabled={!!opening} onClick={() => open(w.id, '/settings')} />
          </div>
        ))}

        {!compact && shared.map(w => {
          const badge = attentionBadge(w, today)
          const busy = opening === w.id
          return (
            <div key={w.id} className="relative">
            <button type="button" onClick={() => open(w.id)} disabled={!!opening}
              className={cn(
                'group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-wait',
                w.id === lastUsedId ? 'border-brand-400' : 'border-brand-200',
                opening && !busy && 'opacity-60'
              )}>
              <span className={cn('relative block h-16', WORKSPACE_TONES[normaliseTone(w.color)].tile)}>
                {w.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.avatarUrl} alt="" aria-hidden="true" className="h-full w-full object-cover opacity-60 blur-sm" />
                )}
                {w.id === lastUsedId && (
                  <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gray-800">Last used</span>
                )}
              </span>
              <span className="relative z-10 -mt-7 px-5">
                <WorkspaceAvatar name={w.name} color={w.color} avatarUrl={w.avatarUrl} size="lg" className="ring-4 ring-white" />
              </span>
              <span className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-3">
                <span>
                  <span className="block truncate font-display text-xl font-bold text-gray-900">{w.name}</span>
                  <span className="block text-xs text-gray-500">{[w.kind, roleLabel(w.role)].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="flex flex-wrap gap-x-4 gap-y-1.5">
                  <Fact icon={CalendarDays}>{w.nextShowDate ? `Next ${formatShortDate(w.nextShowDate)}` : 'Nothing booked'}</Fact>
                  <Fact icon={Users}>{w.memberCount} {w.memberCount === 1 ? 'member' : 'members'}</Fact>
                  {w.tasksDue > 0 && <Fact icon={CheckSquare} warn>{w.tasksDue} task{w.tasksDue === 1 ? '' : 's'} due</Fact>}
                </span>
                {badge && w.tasksDue === 0 && <span className="text-xs font-bold text-amber-700">{badge}</span>}
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-bold text-brand-600">
                  {busy ? <><Spinner className="h-4 w-4" /> Opening…</> : <>Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>}
                </span>
              </span>
            </button>
            <SettingsButton name={w.name} disabled={!!opening} onClick={() => open(w.id, '/settings')} />
            </div>
          )
        })}

        {personal && !q && (
          <div className="relative">
          <button type="button" onClick={() => open(personal.id)} disabled={!!opening}
            className={cn('flex h-full w-full flex-col rounded-2xl border-2 border-dashed bg-brand-50 text-left transition-colors hover:bg-brand-100 disabled:cursor-wait', compact ? 'gap-2 p-4' : 'gap-3 p-5',
              personal.id === lastUsedId ? 'border-brand-400' : 'border-brand-200', opening && opening !== personal.id && 'opacity-60')}>
            <span className={cn('flex items-center justify-center rounded-2xl bg-white text-gray-700 shadow-sm', compact ? 'h-10 w-10' : 'h-14 w-14')}><User className={compact ? 'h-5 w-5' : 'h-6 w-6'} /></span>
            <span>
              <span className={cn('block font-bold text-gray-900', compact ? 'text-base' : 'font-display text-xl')}>Personal space</span>
              <span className="block text-sm text-gray-500">{compact ? 'Just you, plus all your bookings.' : 'Just you. Your own songs and notes, plus one calendar of everything you’re booked for.'}</span>
            </span>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-bold text-brand-600">
              {opening === personal.id ? <><Spinner className="h-4 w-4" /> Opening…</> : <>Open <ArrowRight className="h-4 w-4" /></>}
            </span>
          </button>
          <SettingsButton name="Personal space" disabled={!!opening} onClick={() => open(personal.id, '/settings')} />
          </div>
        )}

        {!q && (
          <div className={cn('flex flex-col gap-3 rounded-2xl border border-brand-200 bg-white', compact ? 'col-span-2 p-4' : 'p-5')}>
            <Link href="/workspace/new" className="flex items-center gap-3 rounded-xl p-2 -m-2 hover:bg-brand-50">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400 text-white"><Plus className="h-5 w-5" /></span>
              <span>
                <span className="block text-sm font-bold text-gray-900">Create a workspace</span>
                <span className="block text-xs text-gray-500">For a band, a venue or a collective</span>
              </span>
            </Link>
            <form id="join" onSubmit={joinWithLink} className="mt-1 scroll-mt-6 border-t border-brand-100 pt-3">
              <label htmlFor="picker-invite" className="flex items-center gap-1.5 text-sm font-bold text-gray-900"><Link2 className="h-4 w-4 text-brand-600" /> Got an invite link?</label>
              <div className="mt-2 flex gap-2">
                <input id="picker-invite" ref={inviteRef} value={invite} onChange={e => { setInvite(e.target.value); setInviteError(null) }} placeholder="Paste it here"
                  className="min-w-0 flex-1 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400" />
                <button type="submit" disabled={!invite.trim()} className="rounded-lg bg-brand-100 px-3 text-sm font-bold text-gray-800 hover:bg-brand-200 disabled:opacity-50">Join</button>
              </div>
              {inviteError && <p className="mt-1 text-xs text-red-600">{inviteError}</p>}
            </form>
          </div>
        )}
      </div>

      {q && shared.length === 0 && <p className="text-sm text-gray-500">No workspace matches “{query}”.</p>}
    </div>
  )
}
