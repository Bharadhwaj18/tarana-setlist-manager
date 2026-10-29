'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/shows'
import { getWorkspaceContext, isFinanceApprover } from '@/lib/workspace'
import { getCachedFinanceSettings } from '@/lib/data'

function friendly(message: string) {
  if (/check_account_balance|finance_account_checks/.test(message) && /does not exist|schema cache|Could not find/.test(message)) {
    return 'Balance checks aren’t switched on in the database yet. Run the balance checks SQL first.'
  }
  return message
}

/**
 * Records what the bank shows for an account. With `adjust`, a correction entry for the difference is added so the
 * account matches the bank; without it, only the check is kept. Returns the difference (bank minus the app).
 */
export async function checkAccountBalance(input: { accountId: string; bank: number; note?: string; date?: string; adjust?: boolean }): Promise<{ difference?: number; error?: string }> {
  if (!Number.isFinite(input.bank)) return { error: 'Enter the balance the bank shows.' }
  const ctx = await getWorkspaceContext()
  if (!ctx) return { error: 'Not authenticated' }
  if (!isFinanceApprover(ctx.current)) return { error: 'Only an admin or treasurer can check an account.' }
  if (!(await getCachedFinanceSettings()).features.accounts) return { error: 'Band accounts are switched off for this workspace.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('check_account_balance', {
    p_ws: ctx.current.workspace.id, p_account: input.accountId, p_bank: input.bank,
    p_date: input.date ?? todayISO(), p_note: input.note?.trim() || undefined, p_adjust: !!input.adjust,
  })
  if (error) return { error: friendly(error.message) }

  revalidatePath('/finance', 'layout')
  return { difference: data }
}
