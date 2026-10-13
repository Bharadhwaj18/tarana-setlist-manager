import Link from 'next/link'
import { Plus, User } from 'lucide-react'
import { getWorkspaceOptions } from '@/lib/workspace-options-server'
import { attentionBadge, formatShortDate, isPersonal, roleLabel, workspaceLabel, type WorkspaceOption } from '@/lib/workspace-options'
import { todayISO } from '@/lib/shows'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusPill } from '@/components/ui/StatusPill'
import { WorkspaceAvatar } from '@/components/ui/WorkspaceAvatar'
import { WorkspaceCardActions } from '@/components/workspaces/WorkspaceCardActions'
import { JoinWithLink } from '@/components/workspaces/JoinWithLink'
import { cn } from '@/lib/utils'

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="rounded-xl bg-brand-50 px-3 py-2">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-500">{label}</div>
      <div className={cn('mt-0.5 text-sm font-bold text-gray-900', tone === 'warn' && 'text-amber-700')}>{value}</div>
    </div>
  )
}

function WorkspaceCard({ w, currentId, today }: { w: WorkspaceOption; currentId: string; today: string }) {
  const personal = isPersonal(w)
  const current = w.id === currentId
  const badge = attentionBadge(w, today)

  return (
    <article className={cn('flex flex-col gap-4 rounded-2xl border p-5 shadow-sm', personal ? 'border-dashed border-brand-300 bg-brand-100/60' : 'border-brand-200 bg-white', current && 'ring-2 ring-brand-400')}>
      <div className="flex items-start gap-3.5">
        {personal ? (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-gray-700"><User className="h-6 w-6" /></span>
        ) : (
          <WorkspaceAvatar name={w.name} color={w.color} avatarUrl={w.avatarUrl} size="lg" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl font-bold text-gray-900">{workspaceLabel(w)}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {personal ? <span className="text-xs text-gray-500">Only you · everything across your workspaces</span> : <StatusPill>{roleLabel(w.role)}</StatusPill>}
            {w.kind && !personal && <span className="text-xs text-gray-500">{w.kind}</span>}
            {current && <StatusPill tone="green">Current</StatusPill>}
          </div>
        </div>
      </div>

      {!personal && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Next show" value={w.nextShowDate ? formatShortDate(w.nextShowDate) : 'None booked'} />
          <Stat label="Tasks due" value={w.tasksDue > 0 ? String(w.tasksDue) : 'None'} tone={w.tasksDue > 0 ? 'warn' : undefined} />
          <Stat label="Members" value={String(w.memberCount)} />
        </div>
      )}
      {badge && !personal && <p className="text-xs font-semibold text-amber-700">{badge}</p>}

      <WorkspaceCardActions id={w.id} currentId={currentId} personal={personal} />
    </article>
  )
}

export default async function WorkspacesPage() {
  const { options, currentId } = await getWorkspaceOptions()
  const today = todayISO()
  const count = options.length

  return (
    <div>
      <PageHeader
        title="Workspaces"
        subtitle={`${count} ${count === 1 ? 'space' : 'spaces'} · one login, switch any time`}
        action={
          <div className="flex gap-2">
            <Link href="/workspaces#join" className="hidden rounded-xl border border-brand-200 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:bg-brand-50 sm:inline-block">Join with a link</Link>
            <Link href="/workspace/new" className="inline-flex items-center gap-1.5 rounded-xl bg-brand-400 px-4 py-2 text-sm font-bold text-white hover:bg-brand-500">
              <Plus className="h-4 w-4" /> New workspace
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {options.map(w => <WorkspaceCard key={w.id} w={w} currentId={currentId} today={today} />)}
      </div>

      <div className="mt-6">
        <JoinWithLink />
      </div>
    </div>
  )
}
