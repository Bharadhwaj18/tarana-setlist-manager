// Pure planning step for account deletion — which of the user's workspaces
// go with them, and which block the deletion outright. No Supabase in here,
// so it's unit-testable on its own (see account-deletion.test.ts).

/** What the user types to confirm — shared by the form and the server check. */
export const DELETE_CONFIRMATION = 'DELETE'

export interface OwnedWorkspace {
  id: string
  name: string
  type: string
  /** Everyone in the workspace, the deleting user included. */
  memberCount: number
}

export interface DeletionPlan {
  /** Workspaces only this user is in — deleted along with the account. */
  deleteWorkspaceIds: string[]
  /** Band workspaces other people still use — ownership must move first. */
  blockedBy: string[]
}

export function planAccountDeletion(owned: OwnedWorkspace[]): DeletionPlan {
  const deleteWorkspaceIds: string[] = []
  const blockedBy: string[] = []
  for (const ws of owned) {
    if (ws.type !== 'personal' && ws.memberCount > 1) blockedBy.push(ws.name)
    else deleteWorkspaceIds.push(ws.id)
  }
  return { deleteWorkspaceIds, blockedBy }
}
