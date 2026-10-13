import { daysUntil } from '@/lib/dates'
import type { WorkspaceMembership } from '@/types/workspace'

/** Everything the switcher UI needs to know about one workspace the user belongs to. */
export interface WorkspaceOption {
  id: string
  name: string
  type: string
  role: string
  kind: string | null
  color: string
  avatarUrl: string | null
  memberCount: number
  nextShowDate: string | null
  tasksDue: number
}

export interface WorkspaceAttentionRow {
  memberCount: number
  nextShowDate: string | null
  tasksDue: number
}

export const isPersonal = (w: Pick<WorkspaceOption, 'type'>) => w.type === 'personal'

export const workspaceLabel = (w: Pick<WorkspaceOption, 'type' | 'name'>) => (w.type === 'personal' ? 'Personal' : w.name)

export function roleLabel(role: string) {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  return 'Member'
}

/** Personal space first, then the rest in the order they were joined. */
export function buildWorkspaceOptions(memberships: WorkspaceMembership[], attention: Record<string, WorkspaceAttentionRow>): WorkspaceOption[] {
  const options = memberships.map(m => {
    const a = attention[m.workspace.id]
    return {
      id: m.workspace.id,
      name: m.workspace.name,
      type: m.workspace.type,
      role: m.role,
      kind: m.workspace.kind,
      color: m.workspace.color,
      avatarUrl: m.workspace.avatar_url,
      memberCount: a?.memberCount ?? 1,
      nextShowDate: a?.nextShowDate ?? null,
      tasksDue: a?.tasksDue ?? 0,
    }
  })
  return [...options.filter(o => isPersonal(o)), ...options.filter(o => !isPersonal(o))]
}

/** "Sat 31 Oct" from a plain YYYY-MM-DD date. */
export function formatShortDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(dateStr + 'T00:00:00Z')).replace(',', '')
}

/** The one thing worth flagging about a workspace right now, if anything. */
export function attentionBadge(w: Pick<WorkspaceOption, 'tasksDue' | 'nextShowDate'>, today: string): string | null {
  if (w.tasksDue > 0) return `${w.tasksDue} task${w.tasksDue === 1 ? '' : 's'} due`
  if (w.nextShowDate) {
    const days = daysUntil(w.nextShowDate, today)
    if (days === 0) return 'Show today'
    if (days === 1) return 'Show tomorrow'
    if (days > 1 && days <= 7) return `Show in ${days} days`
  }
  return null
}

/** One-line description for switcher rows: "Band · 4 members · next show Sat 31 Oct". */
export function workspaceSubtitle(w: WorkspaceOption) {
  if (isPersonal(w)) return 'Just you · all your calendars'
  const members = `${w.memberCount} member${w.memberCount === 1 ? '' : 's'}`
  const next = w.nextShowDate ? `next show ${formatShortDate(w.nextShowDate)}` : 'no shows booked'
  return `${w.kind || 'Workspace'} · ${members} · ${next}`
}
