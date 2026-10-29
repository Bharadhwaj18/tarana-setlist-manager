'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/shows'
import { getWorkspaceContext, isFinanceApprover } from '@/lib/workspace'
import { getCachedAllProfiles, getCachedFinanceAccounts, getCachedFinanceSettings } from '@/lib/data'
import { holderColumns, moveDescriptions, validateMove } from '@/lib/finance/transfers'

function friendly(message: string) {
  if (/move_money/.test(message) && /does not exist|schema cache|Could not find/.test(message)) {
    return 'Moving money isn’t switched on in the database yet. Run the finance moves SQL first.'
  }
  return message
}

/**
 * Moves money between two places it can live: a band account, or a member's pocket (at least one side an account).
 * It isn't income or spending. Both sides are saved together by the database, so they can't get out of step.
 */
export async function moveMoney(input: { from: string; to: string; amount: number; note?: string; date?: string }): Promise<{ error?: string }> {
  const invalid = validateMove(input.from, input.to, input.amount)
  if (invalid) return { error: invalid }
  const ctx = await getWorkspaceContext()
  if (!ctx) return { error: 'Not authenticated' }
  if (!isFinanceApprover(ctx.current)) return { error: 'Only an admin or treasurer can move money.' }
  if (!(await getCachedFinanceSettings()).features.accounts) return { error: 'Band accounts are switched off for this workspace.' }

  const from = holderColumns(input.from)!
  const to = holderColumns(input.to)!
  const [accounts, profiles] = await Promise.all([getCachedFinanceAccounts(), getCachedAllProfiles()])
  // Saved descriptions use real names, never "You": other people read them later.
  const nameOf = (h: { account: string | null; member: string | null }) =>
    h.account ? (accounts.find(a => a.id === h.account)?.name ?? 'an account') : (profiles.find(p => p.id === h.member)?.display_name?.trim() || 'a member')
  const text = moveDescriptions(nameOf(from), nameOf(to), input.note)

  const supabase = await createClient()
  const { error } = await supabase.rpc('move_money', {
    p_ws: ctx.current.workspace.id,
    p_from_account: from.account ?? undefined, p_from_member: from.member ?? undefined,
    p_to_account: to.account ?? undefined, p_to_member: to.member ?? undefined,
    p_amount: input.amount, p_from_desc: text.out, p_to_desc: text.in, p_date: input.date ?? todayISO(),
  })
  if (error) return { error: friendly(error.message) }

  revalidatePath('/finance', 'layout')
  return {}
}
