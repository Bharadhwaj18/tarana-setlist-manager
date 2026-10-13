import { cache } from 'react'
import { getWorkspaceContext } from '@/lib/workspace'
import { getWorkspaceAttention } from '@/lib/data'
import { buildWorkspaceOptions, type WorkspaceOption } from '@/lib/workspace-options'

/** The signed-in user's workspaces as switcher options, with the current one's id. */
export const getWorkspaceOptions = cache(async (): Promise<{ options: WorkspaceOption[]; currentId: string }> => {
  const [ctx, attention] = await Promise.all([getWorkspaceContext(), getWorkspaceAttention()])
  if (!ctx) return { options: [], currentId: '' }
  return { options: buildWorkspaceOptions(ctx.memberships, attention), currentId: ctx.current.workspace.id }
})
