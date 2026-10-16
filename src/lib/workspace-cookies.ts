import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { WORKSPACE_CHOSEN_COOKIE, WORKSPACE_COOKIE } from '@/lib/workspace-shared'

/** Makes a workspace the current one for this visit. Only call after checking the user is a member of it. */
export async function chooseWorkspace(workspaceId: string) {
  const cookieStore = await cookies()
  cookieStore.set(WORKSPACE_COOKIE, workspaceId, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  // No maxAge: lasts for this visit, so the workspace picker shows again next time they come in.
  cookieStore.set(WORKSPACE_CHOSEN_COOKIE, '1', { path: '/', sameSite: 'lax' })
  revalidatePath('/', 'layout')
}
