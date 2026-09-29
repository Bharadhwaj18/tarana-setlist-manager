'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getWorkspaceContext } from '@/lib/workspace'
import { WORKSPACE_COOKIE } from '@/lib/workspace-shared'

export async function switchWorkspace(workspaceId: string): Promise<{ error?: string }> {
  const ctx = await getWorkspaceContext()
  if (!ctx) return { error: 'Not authenticated' }
  if (!ctx.memberships.some(m => m.workspace.id === workspaceId)) return { error: 'You’re not a member of that workspace.' }

  const cookieStore = await cookies()
  cookieStore.set(WORKSPACE_COOKIE, workspaceId, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  revalidatePath('/', 'layout')
  return {}
}
