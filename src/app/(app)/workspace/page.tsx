import Link from 'next/link'
import { CalendarRange, Link2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getCachedAllProfiles } from '@/lib/data'
import { normalisePermissions } from '@/lib/workspace-shared'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { Button } from '@/components/ui/Button'
import { JoinByLink } from '@/components/workspace/JoinByLink'
import { GeneralSettings } from '@/components/workspace/GeneralSettings'
import { MembersSettings } from '@/components/workspace/MembersSettings'
import { InvitesSettings } from '@/components/workspace/InvitesSettings'
import { DangerSettings } from '@/components/workspace/DangerSettings'
import { SETTINGS_TABS, type InviteRow, type MemberRow, type SettingsTab } from '@/components/workspace/settings-types'
import { sectionLevelsFrom } from '@/lib/workspace-sections'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function WorkspacePage({ searchParams }: Props) {
  const { tab: tabParam } = await searchParams
  const ctx = await getWorkspaceContext()
  if (!ctx) return null
  const { workspace, role } = ctx.current

  if (workspace.type === 'personal') {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Personal space" subtitle="This space is just for you: your own songs, notes and tasks. Nobody else can see it." />
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><Plus className="h-5 w-5" /></span>
            <h2 className="font-sans text-base font-bold text-gray-900">Create a workspace</h2>
            <p className="flex-1 text-sm text-gray-500">For your band, a venue or a collective. It gets its own songs, setlists, shows and money, and you invite people with a link.</p>
            <Button asChild className="self-start"><Link href="/workspace/new">Create a workspace</Link></Button>
          </section>
          <section className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><Link2 className="h-5 w-5" /></span>
            <h2 className="font-sans text-base font-bold text-gray-900">Join with an invite link</h2>
            <p className="text-sm text-gray-500">Got a link from someone? Paste it here.</p>
            <JoinByLink />
          </section>
        </div>
        <Link href="/calendar" className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-brand-200 bg-white px-4 py-3 text-sm text-gray-600 hover:bg-brand-50">
          <CalendarRange className="h-4 w-4 text-gray-400" />
          <span className="flex-1">See everything you’re booked for across all your workspaces in one calendar.</span>
          <span className="font-bold text-brand-600">Open calendar</span>
        </Link>
      </div>
    )
  }

  const isOwner = role === 'owner'
  const isAdmin = isOwner || role === 'admin'
  const tab: SettingsTab = SETTINGS_TABS.some(t => t.key === tabParam) ? (tabParam as SettingsTab) : 'general'
  const supabase = await createClient()

  const [{ data: memberRows }, profiles, { data: inviteRows }] = await Promise.all([
    supabase.from('workspace_members').select('user_id, role, permissions, created_at').eq('workspace_id', workspace.id).order('created_at'),
    getCachedAllProfiles(),
    isAdmin
      ? supabase
          .from('workspace_invites')
          .select('id, token, role, expires_at, max_uses, use_count')
          .eq('workspace_id', workspace.id)
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const members: MemberRow[] = (memberRows ?? []).map(m => ({
    userId: m.user_id,
    name: profiles.find(p => p.id === m.user_id)?.display_name?.trim() || 'Unnamed member',
    role: m.role,
    treasurer: normalisePermissions(m.permissions).treasurer === true,
    sections: sectionLevelsFrom(m.permissions, m.role),
    isYou: m.user_id === ctx.userId,
  }))

  const invites: InviteRow[] = (inviteRows ?? [])
    .filter(i => i.max_uses === null || i.use_count < i.max_uses)
    .map(i => ({ id: i.id, token: i.token, role: i.role, expiresAt: i.expires_at, maxUses: i.max_uses, useCount: i.use_count }))

  const summary = {
    id: workspace.id,
    name: workspace.name,
    kind: workspace.kind ?? null,
    description: workspace.description ?? null,
    color: workspace.color,
    avatarUrl: workspace.avatar_url ?? null,
  }

  const visibleTabs = SETTINGS_TABS.filter(t => t.key !== 'invites' || isAdmin)
  const activeTab: SettingsTab = visibleTabs.some(t => t.key === tab) ? tab : 'general'

  return (
    <div className="max-w-4xl">
      <PageHeader title="Workspace settings" subtitle={workspace.name} />

      <div className="grid gap-5 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Workspace settings" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
          {visibleTabs.map(t => (
            <Link
              key={t.key}
              href={t.key === 'general' ? '/workspace' : `/workspace?tab=${t.key}`}
              aria-current={activeTab === t.key ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors lg:rounded-lg lg:py-2.5',
                activeTab === t.key
                  ? 'bg-brand-400 text-white'
                  : t.key === 'danger'
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 lg:bg-transparent'
                    : 'bg-brand-100 text-gray-700 hover:bg-brand-200 lg:bg-transparent lg:hover:bg-brand-100'
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="min-w-0">
          <SectionLabel className="mb-3">{visibleTabs.find(t => t.key === activeTab)?.label}</SectionLabel>
          {activeTab === 'general' && <GeneralSettings workspace={summary} canEdit={isAdmin} />}
          {activeTab === 'members' && <MembersSettings workspaceName={workspace.name} members={members} isAdmin={isAdmin} isOwner={isOwner} activeInviteCount={invites.length} />}
          {activeTab === 'invites' && isAdmin && <InvitesSettings invites={invites} />}
          {activeTab === 'danger' && <DangerSettings workspaceName={workspace.name} members={members} isAdmin={isAdmin} isOwner={isOwner} />}
        </div>
      </div>
    </div>
  )
}
