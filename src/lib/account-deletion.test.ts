import { describe, it, expect } from 'vitest'
import { planAccountDeletion } from './account-deletion'

describe('planAccountDeletion', () => {
  it('deletes the personal workspace and bands nobody else is in', () => {
    const plan = planAccountDeletion([
      { id: 'p', name: 'Personal', type: 'personal', memberCount: 1 },
      { id: 'b', name: 'Solo band', type: 'band', memberCount: 1 },
    ])
    expect(plan).toEqual({ deleteWorkspaceIds: ['p', 'b'], blockedBy: [] })
  })

  it('blocks on a band other members still use', () => {
    const plan = planAccountDeletion([
      { id: 'p', name: 'Personal', type: 'personal', memberCount: 1 },
      { id: 'b', name: 'The Band', type: 'band', memberCount: 4 },
    ])
    expect(plan.blockedBy).toEqual(['The Band'])
    expect(plan.deleteWorkspaceIds).toEqual(['p'])
  })

  it('has nothing to do for a user who owns no workspaces', () => {
    expect(planAccountDeletion([])).toEqual({ deleteWorkspaceIds: [], blockedBy: [] })
  })
})
