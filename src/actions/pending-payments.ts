'use server'

import { getCachedFinanceSettings } from '@/lib/data'
import { formatMoney } from '@/lib/finance/settings'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/shows'
import { sendNotification } from '@/actions/notifications'
import { getWorkspaceContext, isFinanceApprover, requireWorkspaceId } from '@/lib/workspace'
import { getCachedFinanceAccounts } from '@/lib/data'
import { accountIdOf, isAccountValue } from '@/lib/finance/accounts'

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
  // An account can pay too, but only admins and treasurers hand out its money.
  const fromAccount = accountIdOf(payerId)
  if (isAccountValue(payerId)) {
    const ctx = await getWorkspaceContext()
    if (!ctx || !isFinanceApprover(ctx.current)) return { error: 'Only an admin or treasurer can pay from an account.' }
    if (!(await getCachedFinanceAccounts()).some(a => a.id === fromAccount && !a.archived)) return { error: 'That account is archived or missing.' }
  }

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

  const existing = (open ?? []).find(p => fromAccount ? p.from_account === fromAccount : p.from_member === payerId)
  let paymentId: string | null = existing?.id ?? null
  if (existing) {
    const { error } = await supabase
      .from('pending_payments')
      .update({ amount: Math.round((existing.amount + amount) * 100) / 100 })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { data: recipient } = await supabase.from('profiles').select('display_name').eq('id', memberId).maybeSingle()
    const { data: created, error } = await supabase.from('pending_payments').insert({
      from_member: fromAccount ? null : payerId,
      from_account: fromAccount,
      to_member: memberId,
      amount,
      description: `Balance reimbursement to ${recipient?.display_name ?? 'member'}`,
      category: BALANCE_REIMBURSEMENT,
      show_id: null,
      workspace_id: workspaceId,
    }).select('id').single()
    if (error) return { error: error.message }
    paymentId = created.id
  }

  if (!fromAccount && payerId !== user.id) {
    await sendNotification({
      recipientId: payerId,
      title: `You owe ${await moneyText(amount)}`,
      body: 'Balance reimbursement',
      link: paymentId ? `/finance?pay=${paymentId}` : '/finance',
      type: 'payment_owed',
    })
  }

  revalidatePath('/finance')
  return {}
}

/**
 * Marks a pending payment as paid, once the money has actually changed hands — this is what turns it into a
 * real debit (on the payer, or on the account paying). Trust-based, same as the rest of this app: the payer,
 * the person being paid, or a treasurer can say so. `reference` is an optional UPI or bank reference.
 */
export async function markPendingPaymentPaid(id: string, reference?: string): Promise<{ error?: string }> {
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
  const { error: payErr } = await supabase.rpc('mark_pending_payment_paid', { p_id: id, p_date: todayISO(), p_ref: reference?.trim() || undefined })
  if (payErr) return { error: payErr.message }

  const { data: actor } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
  const actorName = actor?.display_name ?? 'Someone'
  const accountName = pending.from_account ? ((await getCachedFinanceAccounts()).find(a => a.id === pending.from_account)?.name ?? 'The account') : null
  if (pending.to_member !== user.id) {
    await sendNotification({
      recipientId: pending.to_member,
      title: `${accountName ?? actorName} paid you ${await moneyText(pending.amount)}`,
      body: pending.description,
      link: '/finance/history',
      type: 'payment_received',
    })
  } else if (pending.from_account) {
    // The person being paid said they got it: tell the treasurers, who'd otherwise be waiting to mark it.
    const { data: staff } = await supabase.from('workspace_members').select('user_id, role, permissions').eq('workspace_id', pending.workspace_id ?? '')
    const { data: payee } = await supabase.from('profiles').select('display_name').eq('id', pending.to_member).maybeSingle()
    for (const m of staff ?? []) {
      const isStaff = m.role === 'owner' || m.role === 'admin' || (m.permissions as Record<string, unknown> | null)?.treasurer === true
      if (!isStaff || m.user_id === user.id) continue
      await sendNotification({
        recipientId: m.user_id,
        title: `${payee?.display_name ?? 'A member'} got ${await moneyText(pending.amount)} from ${accountName}`,
        body: pending.description,
        link: '/finance/history',
        type: 'payment_received',
      })
    }
  }

  revalidatePath('/finance')
  revalidatePath('/finance/history')
  revalidatePath('/finance/split-history')
  return {}
}
