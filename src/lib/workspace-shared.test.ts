import { describe, it, expect } from 'vitest'
import { pickCurrentWorkspace, normalisePermissions } from './workspace-shared'
import type { WorkspaceMembership } from '@/types/workspace'

const m = (id: string, type: string, created_at: string): WorkspaceMembership => ({
  workspace: {
    id, name: id, type, owner_id: 'u', plan: 'free', status: 'active', trial_ends_at: null,
    past_due_since: null, read_only_until: null, blocked_at: null, settings: {}, created_at,
  },
  role: 'member',
  permissions: {},
})

describe('pickCurrentWorkspace', () => {
  const personal = m('me', 'personal', '2026-01-01')
  const bandA = m('a', 'band', '2026-02-01')
  const bandB = m('b', 'band', '2026-03-01')

  it('honours a valid cookie', () => {
    expect(pickCurrentWorkspace([personal, bandA, bandB], 'b').workspace.id).toBe('b')
    expect(pickCurrentWorkspace([personal, bandA], 'me').workspace.id).toBe('me')
  })
  it('ignores a cookie for a workspace the user is not in', () => {
    expect(pickCurrentWorkspace([personal, bandA], 'zzz').workspace.id).toBe('a')
  })
  it('defaults to the oldest band, then personal', () => {
    expect(pickCurrentWorkspace([bandB, personal, bandA], undefined).workspace.id).toBe('a')
    expect(pickCurrentWorkspace([personal], undefined).workspace.id).toBe('me')
  })
})

describe('normalisePermissions', () => {
  it('keeps only true flags as booleans and tolerates junk', () => {
    expect(normalisePermissions({ treasurer: true, x: 'yes' })).toEqual({ treasurer: true, x: false })
    expect(normalisePermissions(null)).toEqual({})
    expect(normalisePermissions([1])).toEqual({})
  })
})
