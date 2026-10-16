'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { MAX_GROUP_NAME, MAX_GROUP_NOTES, isGroupColor, type GroupSees } from '@/lib/groups'

/** Errors from the database, in words people can act on. */
function friendly(message: string, name?: string) {
  if (/workspace_group|song_group_notes/.test(message) && /does not exist|schema cache/.test(message)) {
    return 'Groups aren’t switched on yet. Run the groups SQL in Supabase first.'
  }
  if (/workspace_groups_name_idx|duplicate key/.test(message)) return `There’s already a group called “${name ?? 'that'}”.`
  if (/row-level security/.test(message)) return 'Only owners and admins can change groups.'
  return message
}

/** The current workspace, only when the caller is an owner or admin of it. */
async function adminWorkspace(): Promise<{ workspaceId: string } | { error: string }> {
  const ctx = await getWorkspaceContext()
  if (!ctx) return { error: 'Not authenticated' }
  if (ctx.current.role !== 'owner' && ctx.current.role !== 'admin') return { error: 'Only owners and admins can change groups.' }
  return { workspaceId: ctx.current.workspace.id }
}

interface GroupInput {
  name: string
  color: string
  sees: GroupSees
  memberIds: string[]
}

function clean(input: GroupInput): { name: string; color: string; sees: GroupSees; memberIds: string[] } | { error: string } {
  const name = input.name.trim().slice(0, MAX_GROUP_NAME)
  if (!name) return { error: 'Give the group a name, like Vocals or Rhythm.' }
  if (!isGroupColor(input.color)) return { error: 'Pick a colour for the group.' }
  return { name, color: input.color, sees: input.sees === 'chart' ? 'chart' : 'notes', memberIds: [...new Set(input.memberIds)] }
}

async function setGroupMembers(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string, groupId: string, memberIds: string[]) {
  const { error: delError } = await supabase.from('workspace_group_members').delete().eq('group_id', groupId)
  if (delError) return delError.message
  if (!memberIds.length) return null
  const { error } = await supabase.from('workspace_group_members').insert(memberIds.map(userId => ({ group_id: groupId, user_id: userId, workspace_id: workspaceId })))
  return error?.message ?? null
}

function refresh() {
  revalidatePath('/settings/members')
  revalidatePath('/songs', 'layout')
}

export async function createGroup(input: GroupInput): Promise<{ id?: string; error?: string }> {
  const ws = await adminWorkspace()
  if ('error' in ws) return ws
  const g = clean(input)
  if ('error' in g) return g
  const supabase = await createClient()
  const { data: last } = await supabase.from('workspace_groups').select('position').eq('workspace_id', ws.workspaceId)
    .order('position', { ascending: false }).limit(1).maybeSingle()
  const { data, error } = await supabase.from('workspace_groups')
    .insert({ workspace_id: ws.workspaceId, name: g.name, color: g.color, sees: g.sees, position: (last?.position ?? 0) + 1 })
    .select('id').single()
  if (error) return { error: friendly(error.message, g.name) }
  const memberError = await setGroupMembers(supabase, ws.workspaceId, data.id, g.memberIds)
  if (memberError) return { error: friendly(memberError) }
  refresh()
  return { id: data.id }
}

export async function updateGroup(id: string, input: GroupInput): Promise<{ error?: string }> {
  const ws = await adminWorkspace()
  if ('error' in ws) return ws
  const g = clean(input)
  if ('error' in g) return g
  const supabase = await createClient()
  const { error } = await supabase.from('workspace_groups').update({ name: g.name, color: g.color, sees: g.sees })
    .eq('id', id).eq('workspace_id', ws.workspaceId)
  if (error) return { error: friendly(error.message, g.name) }
  const memberError = await setGroupMembers(supabase, ws.workspaceId, id, g.memberIds)
  if (memberError) return { error: friendly(memberError) }
  refresh()
  return {}
}

export async function deleteGroup(id: string): Promise<{ error?: string }> {
  const ws = await adminWorkspace()
  if ('error' in ws) return ws
  const supabase = await createClient()
  const { error } = await supabase.from('workspace_groups').delete().eq('id', id).eq('workspace_id', ws.workspaceId)
  if (error) return { error: friendly(error.message) }
  refresh()
  return {}
}

/** Put one member in exactly these groups. */
export async function setMemberGroups(userId: string, groupIds: string[]): Promise<{ error?: string }> {
  const ws = await adminWorkspace()
  if ('error' in ws) return ws
  const supabase = await createClient()
  const { error: delError } = await supabase.from('workspace_group_members').delete().eq('workspace_id', ws.workspaceId).eq('user_id', userId)
  if (delError) return { error: friendly(delError.message) }
  const ids = [...new Set(groupIds)]
  if (ids.length) {
    const { error } = await supabase.from('workspace_group_members').insert(ids.map(groupId => ({ group_id: groupId, user_id: userId, workspace_id: ws.workspaceId })))
    if (error) return { error: friendly(error.message) }
  }
  refresh()
  return {}
}

/** Save a group's notes on a song. The group's own members, or anyone who can edit songs, may do this. */
export async function saveGroupNotes(songId: string, groupId: string, content: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (content.length > MAX_GROUP_NOTES) return { error: 'Those notes are too long to save.' }
  const { data: song } = await supabase.from('songs').select('workspace_id').eq('id', songId).maybeSingle()
  if (!song?.workspace_id) return { error: 'That song is no longer there.' }
  const { error } = await supabase.from('song_group_notes').upsert(
    { workspace_id: song.workspace_id, song_id: songId, group_id: groupId, content, updated_by: user.id, updated_at: new Date().toISOString() },
    { onConflict: 'song_id,group_id' },
  )
  if (error) return { error: /row-level security/.test(error.message) ? 'Only this group’s members, or people who can edit songs, can write its notes.' : friendly(error.message) }
  revalidatePath(`/songs/${songId}`)
  return {}
}
