import { describe, it, expect } from 'vitest'
import { attentionBadge, workspaceSubtitle, roleLabel, type WorkspaceOption } from './workspace-options'
import { parseInviteToken } from './invite-link'

const ws = (over: Partial<WorkspaceOption>): WorkspaceOption => ({
  id: 'w', name: 'Band', type: 'band', role: 'member', kind: 'Band', color: 'forest', avatarUrl: null,
  memberCount: 4, nextShowDate: null, tasksDue: 0, ...over,
})

describe('attentionBadge', () => {
  const today = '2026-10-13'
  it('prefers tasks due, then a show inside a week, otherwise nothing', () => {
    expect(attentionBadge({ tasksDue: 2, nextShowDate: '2026-10-14' }, today)).toBe('2 tasks due')
    expect(attentionBadge({ tasksDue: 1, nextShowDate: null }, today)).toBe('1 task due')
    expect(attentionBadge({ tasksDue: 0, nextShowDate: '2026-10-16' }, today)).toBe('Show in 3 days')
    expect(attentionBadge({ tasksDue: 0, nextShowDate: '2026-10-13' }, today)).toBe('Show today')
    expect(attentionBadge({ tasksDue: 0, nextShowDate: '2026-10-14' }, today)).toBe('Show tomorrow')
    expect(attentionBadge({ tasksDue: 0, nextShowDate: '2026-11-30' }, today)).toBeNull()
  })
})

describe('workspaceSubtitle / roleLabel', () => {
  it('describes personal and shared workspaces', () => {
    expect(workspaceSubtitle(ws({ type: 'personal' }))).toBe('Just you · all your calendars')
    expect(workspaceSubtitle(ws({ nextShowDate: '2026-10-31' }))).toBe('Band · 4 members · next show Sat 31 Oct')
    expect(workspaceSubtitle(ws({ kind: null, memberCount: 1 }))).toBe('Workspace · 1 member · no shows booked')
    expect(roleLabel('owner')).toBe('Owner')
    expect(roleLabel('whatever')).toBe('Member')
  })
})

describe('parseInviteToken', () => {
  it('reads a token from a full link, a path, or the bare token', () => {
    expect(parseInviteToken('https://app.example.com/invite/abc123XYZ?x=1')).toBe('abc123XYZ')
    expect(parseInviteToken('/invite/abc123XYZ')).toBe('abc123XYZ')
    expect(parseInviteToken('  abc123XYZ  ')).toBe('abc123XYZ')
    expect(parseInviteToken('nope!')).toBeNull()
    expect(parseInviteToken('')).toBeNull()
  })
})
