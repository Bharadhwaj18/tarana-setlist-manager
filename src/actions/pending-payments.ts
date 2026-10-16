'use server'

import { getCachedFinanceSettings } from '@/lib/data'
import { formatMoney } from '@/lib/finance/settings'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/shows'
import { sendNotification } from '@/actions/notifications'
import { requireWorkspaceId } from '@/lib/workspace'

const BALANCE_REIMBURSEMENT = 'balance_reimbursement'

/**
 * Standalone reimbursement of a member's negative balance, independent of any
 * show split: the chosen payer owes them the outstanding negative. If that
 * same payer already has an unpaid balance reimbursement to this member, the
 * amount is added onto it instead of creating a second row.
 */
/** An amount in the workspace's currency, for notification text. */
async function moneyText(n: number) {
  return formatMoney(n, (await getCachedFinanceSettings()).currency)
}

export async function requestBalanceReimbursement(memberId: string, payerId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (memberId === payerId) return { error: 'The payer must be someone else.' }
  const workspaceId = await requireWorkspaceId()

  const { data: txns, error: txErr } = await supabase
    .from('finance_transactions')
    .select('amount, category')
    .eq('workspace_id', workspaceId)
    .eq('member_id', memberId)
  if (txErr) return { error: txErr.message }
  const balance = (txns ?? []).filter(t => t.category !== 'reimbursement').reduce((s, t) => s + t.amount, 0)

  const { data: open, error: openErr } = await supabase
    .from('pending_payments')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('to_member', memberId)
    .eq('category', BALANCE_REIMBURSEMENT)
    .is('paid_at', null)
  if (openErr) return { error: openErr.message }

  const alreadyPending = (open ?? []).reduce((s, p) => s + p.amount, 0)
  const amount = Math.round((-balance - alreadyPending) * 100) / 100
  if (amount <= 0) return { error: 'Nothing left to reimburse for this member.' }

  const existing = (open ?? []).find(p => p.from_member === payerId)
  if (existing) {
    const { error } = await supabase
      .from('pending_payments')
      .update({ amount: Math.round((existing.amount + amount) * 100) / 100 })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { data: recipient } = await supabase.from('profiles').select('display_name').eq('id', memberId).maybeSingle()
    const { error } = await supabase.from('pending_payments').insert({
      from_member: payerId,
      to_member: memberId,
      amount,
      description: `Balance reimbursement to ${recipient?.display_name ?? 'member'}`,
      category: BALANCE_REIMBURSEMENT,
      show_id: null,
      workspace_id: workspaceId,
    })
    if (error) return { error: error.message }
  }

  if (payerId !== user.id) {
    await sendNotification({
      recipientId: payerId,
      title: `You owe ${await moneyText(amount)}`,
      body: 'Balance reimbursement',
      link: '/finance',
      type: 'payment_owed',
    })
  }

  revalidatePath('/finance')
  return {}
}

/**
 * The payer marks a pending split payment as paid, once they've actually
 * handed the money over — this is what turns it into a real Band Fund
 * debit. Trust-based, same as the rest of this app: the payer's own word
 * is enough (a treasurer can also do it, e.g. correcting on someone's
 * behalf), no recipient confirmation required.
 */
export async function markPendingPaymentPaid(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: pending, error: fetchErr } = await supabase
    .from('pending_payments')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }
  if (!pending) return { error: 'This payment no longer exists.' }
  if (pending.paid_at) return { error: 'Already marked paid.' }

  // One database call does the debit, the recipient's credit for a balance
  // reimbursement, and the paid stamp together — and checks payer-or-treasurer
  // itself, so it works even with treasurer approval switched on.
  const { error: payErr } = await supabase.rpc('mark_pending_payment_paid', { p_id: id, p_date: todayISO() })
  if (payErr) return { error: payErr.message }

  if (pending.to_member !== user.id) {
    const { data: actor } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
    await sendNotification({
      recipientId: pending.to_member,
      title: `${actor?.display_name ?? 'Someone'} paid you ${await moneyText(pending.amount)}`,
      body: pending.description,
      link: '/finance/history',
      type: 'payment_received',
    })
  }

  revalidatePath('/finance')
  revalidatePath('/finance/history')
  revalidatePath('/finance/split-history')
  return {}
}
