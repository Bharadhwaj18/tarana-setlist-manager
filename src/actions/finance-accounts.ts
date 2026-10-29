'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { MAX_ACCOUNTS, type AccountKind } from '@/lib/finance/accounts'

const MAX_NAME = 40
const MAX_UPI = 80

/** Errors from the database, in words people can act on. */
function friendly(message: string, name?: string) {
  if (/finance_accounts/.test(message) && /does not exist|schema cache/.test(message)) {
    return 'Band accounts aren’t switched on in the database yet. Run the finance accounts SQL first.'
  }
  if (/up to 5 accounts/.test(message)) return `A workspace can have up to ${MAX_ACCOUNTS} accounts. Archive one to add another.`
  if (/finance_accounts_name_idx|duplicate key/.test(message)) return `There’s already an account called “${name ?? 'that'}”.`
  if (/foreign key|finance_transactions_account_fkey|finance_requests_account_fkey/.test(message)) {
    return 'This account has entries, so it can’t be deleted. Archive it instead.'
  }
  if (/row-level security/.test(message)) return 'Only owners and admins can change accounts.'
  return message
}

async function adminWorkspace(): Promise<{ workspaceId: string } | { error: string }> {
  const ctx = await getWorkspaceContext()
  if (!ctx) return { error: 'Not authenticated' }
  if (ctx.current.role !== 'owner' && ctx.current.role !== 'admin') return { error: 'Only owners and admins can change accounts.' }
  return { workspaceId: ctx.current.workspace.id }
}

interface AccountInput {
  name: string
  kind: AccountKind
  /** A member's id, or null for the band itself. */
  heldBy: string | null
  upiId: string
}

function clean(input: AccountInput): { name: string; kind: AccountKind; heldBy: string | null; upiId: string | null } | { error: string } {
  const name = input.name.trim().slice(0, MAX_NAME)
  if (!name) return { error: 'Give the account a name, like Band account.' }
  const upi = input.upiId.trim().slice(0, MAX_UPI)
  return { name, kind: input.kind === 'cash' ? 'cash' : 'bank', heldBy: input.heldBy || null, upiId: upi || null }
}

function refresh() {
  revalidatePath('/finance', 'layout')
  revalidatePath('/settings', 'layout')
}

export async function createAccount(input: AccountInput): Promise<{ id?: string; error?: string }> {
  const ws = await adminWorkspace()
  if ('error' in ws) return ws
  const a = clean(input)
  if ('error' in a) return a
  const supabase = await createClient()
  const { data: last } = await supabase.from('finance_accounts').select('position').eq('workspace_id', ws.workspaceId)
    .order('position', { ascending: false }).limit(1).maybeSingle()
  const { data, error } = await supabase.from('finance_accounts')
    .insert({ workspace_id: ws.workspaceId, name: a.name, kind: a.kind, held_by: a.heldBy, upi_id: a.upiId, position: (last?.position ?? 0) + 1 })
    .select('id').single()
  if (error) return { error: friendly(error.message, a.name) }
  refresh()
  return { id: data.id }
}

export async function updateAccount(id: string, input: AccountInput): Promise<{ error?: string }> {
  const ws = await adminWorkspace()
  if ('error' in ws) return ws
  const a = clean(input)
  if ('error' in a) return a
  const supabase = await createClient()
  const { error } = await supabase.from('finance_accounts')
    .update({ name: a.name, kind: a.kind, held_by: a.heldBy, upi_id: a.upiId })
    .eq('id', id).eq('workspace_id', ws.workspaceId)
  if (error) return { error: friendly(error.message, a.name) }
  refresh()
  return {}
}

/** Archive hides an account from new entries and keeps its history. Bringing it back needs a free slot (max 5). */
export async function setAccountArchived(id: string, archived: boolean): Promise<{ error?: string }> {
  const ws = await adminWorkspace()
  if ('error' in ws) return ws
  const supabase = await createClient()
  const { error } = await supabase.from('finance_accounts')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id).eq('workspace_id', ws.workspaceId)
  if (error) return { error: friendly(error.message) }
  refresh()
  return {}
}

/** Only an account with no entries can be deleted; the database refuses otherwise. */
export async function deleteAccount(id: string): Promise<{ error?: string }> {
  const ws = await adminWorkspace()
  if ('error' in ws) return ws
  const supabase = await createClient()
  const { error } = await supabase.from('finance_accounts').delete().eq('id', id).eq('workspace_id', ws.workspaceId)
  if (error) return { error: friendly(error.message) }
  refresh()
  return {}
}
