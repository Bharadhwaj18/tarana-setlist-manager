'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/shows'
import { getCachedAllProfiles } from '@/lib/data'
import { hasWorkspacePermission, isCurrentTreasurer, requireWorkspaceId } from '@/lib/workspace'
import { transactionInputSchema } from '@/lib/validators'
import { z } from 'zod'
import { sendNotification, sendNotificationToAll } from '@/actions/notifications'
import type { Json } from '@/types/database'
import type { SplitRunReport, SplitRunShow } from '@/types/split-run'

async function requireTreasurer(): Promise<string | null> {
  if (!(await isCurrentTreasurer())) return 'Only a treasurer can do this.'
  return null
}

type TransactionInput = z.input<typeof transactionInputSchema>

/**
 * Shared by add and update. A debit is always allowed to take a member's
 * balance below zero, show-tagged or not — there's no up-front check for
 * it. A negative balance just means they're owed a reimbursement; the
 * Finance page flags it live (anyone currently below ₹0), and a show-tagged
 * front also gets made whole automatically when that show is split (see
 * lib/finance/settlement.ts's computeBalanceTopUp).
 */
async function validateTransactionWrite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  data: TransactionInput,
  workspaceId: string
): Promise<string | null> {
  // A budget only ever tracks Misc spending: a debit with no show attached.
  if (data.budget_id && (data.amount >= 0 || data.show_id || data.category === 'reimbursement')) {
    return 'Only Misc expenses (not show-related, not a credit) can be tagged to a budget.'
  }

  if (data.member_id) {
    const { data: member } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', data.member_id)
      .maybeSingle()
    if (!member) return 'That person is not a member of this workspace.'
  }

  // A show that's already been split is locked — redirect this to a Misc
  // expense instead of reopening the split (per the decided policy).
  if (data.show_id) {
    const { data: show } = await supabase.from('shows').select('split_at, workspace_id').eq('id', data.show_id).maybeSingle()
    if (!show || show.workspace_id !== workspaceId) return 'Show not found.'
    if (show.split_at) {
      return 'This show has already been split. Log this as a Misc expense instead.'
    }
  }

  return null
}

/** Only a treasurer, or whoever recorded the entry, may change or remove it. */
async function requireCanModifyTransaction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  id: string
): Promise<{ workspaceId?: string; error?: string }> {
  const { data: row } = await supabase
    .from('finance_transactions')
    .select('recorded_by, workspace_id')
    .eq('id', id)
    .maybeSingle()
  if (!row || !row.workspace_id) return { error: 'Transaction not found.' }
  if (row.recorded_by !== userId && !(await hasWorkspacePermission(userId, row.workspace_id, 'treasurer'))) {
    return { error: 'Only a treasurer or the person who recorded this can change it.' }
  }
  return { workspaceId: row.workspace_id }
}

function parseTransaction(data: TransactionInput, userId: string) {
  const parsed = transactionInputSchema.safeParse({ ...data, member_id: data.member_id ?? userId })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid transaction.' } as const
  return { ok: true, data: parsed.data } as const
}

export async function addTransaction(data: TransactionInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // "Paid by / Received by" is optional in the form — Band Fund was removed
  // as a choice there entirely (it never physically holds cash), so a blank
  // selection unambiguously means "whoever's submitting this."
  const parsed = parseTransaction(data, user.id)
  if (!parsed.ok) return { error: parsed.error }
  const tx = parsed.data
  const workspaceId = await requireWorkspaceId()

  const validationError = await validateTransactionWrite(supabase, tx, workspaceId)
  if (validationError) return { error: validationError }

  const { error } = await supabase.from('finance_transactions').insert({
    member_id: tx.member_id,
    amount: tx.amount,
    description: tx.description,
    category: tx.category ?? null,
    show_id: tx.show_id ?? null,
    budget_id: tx.budget_id ?? null,
    workspace_id: workspaceId,
    date: tx.date ?? todayISO(),
    recorded_by: user.id,
  })
  if (error) return { error: error.message }

  // Money coming in is worth telling the whole band about — an expense
  // (negative amount) isn't, that's just routine bookkeeping.
  if (tx.amount > 0) {
    const { data: actor } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
    await sendNotificationToAll({
      title: `${actor?.display_name ?? 'Someone'} logged a credit of ₹${tx.amount.toLocaleString('en-IN')}`,
      body: tx.description,
      link: '/finance',
      type: 'transaction_credit',
    })
  }

  revalidatePath('/finance')
  revalidatePath('/finance/split')
  revalidatePath('/finance/history')
  return {}
}

export async function updateTransaction(id: string, data: TransactionInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const access = await requireCanModifyTransaction(supabase, user.id, id)
  if (access.error || !access.workspaceId) return { error: access.error }

  const parsed = parseTransaction(data, user.id)
  if (!parsed.ok) return { error: parsed.error }
  const tx = parsed.data

  const validationError = await validateTransactionWrite(supabase, tx, access.workspaceId)
  if (validationError) return { error: validationError }

  const { error } = await supabase.from('finance_transactions').update({
    member_id: tx.member_id,
    amount: tx.amount,
    description: tx.description,
    category: tx.category ?? null,
    show_id: tx.show_id ?? null,
    budget_id: tx.budget_id ?? null,
    date: tx.date ?? todayISO(),
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finance')
  revalidatePath('/finance/split')
  revalidatePath('/finance/history')
  return {}
}

export async function deleteTransaction(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const access = await requireCanModifyTransaction(supabase, user.id, id)
  if (access.error) return { error: access.error }

  const { error } = await supabase.from('finance_transactions').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finance')
  revalidatePath('/finance/split')
  revalidatePath('/finance/history')
  return {}
}

// Quick inline "+ New show..." creation from AddTransactionModal — just the
// bare minimum fields. Full show CRUD (fee, TDS, notes, delete) lives in
// '@/actions/shows', since Shows is now its own base entity, not
// finance-specific.
export async function addShow(data: {
  title: string
  show_date?: string | null
  venue?: string | null
}): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: inserted, error } = await supabase
    .from('shows')
    .insert({ ...data, created_by: user.id, workspace_id: await requireWorkspaceId(), })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/finance')
  revalidatePath('/finance/split')
  revalidatePath('/shows')
  return { id: inserted?.id }
}

export interface ShowSplitInput {
  showId: string
  showTitle: string
}

export interface SplitPayment {
  /** who's paying — gets debited */
  from: string
  /** who this covers — never credited; the moment it's paid it's personal money, out of scope for this app */
  to: string
  amount: number
  description: string
}

/**
 * Confirms a batch split — one or more shows at once. Every payment (who
 * pays whom how much, already fully resolved by the caller — see
 * lib/finance/settlement.ts's routeSettlement, or a treasurer's manual
 * assignment) resolves to exactly one debit on the payer, eventually.
 * Nobody is ever credited: this section only tracks Band Fund, and money
 * paid out to someone becomes their personal money the instant it's paid,
 * out of scope from then on.
 *
 * A self-payment (from === to, someone covering their own share from their
 * own Band Fund) is a same-person internal transfer — nothing physically
 * needs to change hands, so it's written immediately as a real debit, same
 * as before. A payer-to-recipient payment is real money someone still has
 * to actually hand over, so it's held as a `pending_payments` row instead —
 * it only becomes a real finance_transactions debit once the payer marks
 * it paid (see markPendingPaymentPaid in actions/pending-payments.ts). The
 * show is still marked split immediately either way; Band Fund balances
 * just reflect only what's actually been paid so far.
 */
export async function splitShows(shows: ShowSplitInput[], payments: SplitPayment[], report: SplitRunReport): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const permissionError = await requireTreasurer()
  if (permissionError) return { error: permissionError }

  if (!shows.length) return { error: 'Pick at least one show.' }
  const workspaceId = await requireWorkspaceId()
  const real = payments.filter(p => p.amount > 0)

  // Names are frozen into the run so Split History never has to re-derive them.
  const ids = [...new Set(real.flatMap(p => [p.from, p.to]))]
  const showIds = shows.map(s => s.showId)
  const [{ data: people }, { data: showRows }] = await Promise.all([
    ids.length ? supabase.from('profiles').select('id, display_name').in('id', ids) : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
    supabase.from('shows').select('id, show_date').in('id', showIds),
  ])
  const nameOf = (id: string) => people?.find(p => p.id === id)?.display_name ?? 'Member'
  const runShows: SplitRunShow[] = report.shows.map((rs, i) => {
    const row = showRows?.find(r => r.id === shows[i]?.showId)
    return { id: shows[i]?.showId ?? '', title: rs.showTitle, date: row?.show_date ?? null, net: rs.net }
  })

  // One transaction in the database: either the whole split lands or none of it.
  const { error: rpcErr } = await supabase.rpc('run_split', {
    p_workspace_id: workspaceId,
    p_show_ids: showIds,
    p_payments: real.map(p => ({ ...p, fromName: nameOf(p.from), toName: nameOf(p.to) })) as unknown as Json,
    p_run_shows: runShows as unknown as Json,
    p_report: report as unknown as Json,
    p_band_pct: report.bandPct,
    p_total_net: report.totalNet,
    p_total_band_fund: report.totalBandFund,
    p_today: todayISO(),
  })
  if (rpcErr) return { error: rpcErr.message }

  // Told after the split is safely committed, and in parallel.
  await Promise.allSettled(
    real
      .filter(p => p.from !== p.to && p.from !== user.id)
      .map(p => sendNotification({
        recipientId: p.from,
        title: `You owe ₹${p.amount.toLocaleString('en-IN')}`,
        body: p.description,
        link: '/finance',
        type: 'payment_owed',
      }))
  )

  revalidatePath('/finance')
  revalidatePath('/finance/split')
  redirect('/finance')
}

export async function exportTransactions(filters: {
  dateFrom?: string
  dateTo?: string
  memberId?: string | 'all' | 'fund'
}): Promise<{ data?: { date: string; member: string; description: string; amount: number }[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  let query = supabase
    .from('finance_transactions')
    .select('*')
    .eq('workspace_id', await requireWorkspaceId())
    .order('date', { ascending: false })

  if (filters.dateFrom) query = query.gte('date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('date', filters.dateTo)
  if (filters.memberId === 'fund') query = query.is('member_id', null)
  else if (filters.memberId && filters.memberId !== 'all') query = query.eq('member_id', filters.memberId)

  const { data: txns, error } = await query
  if (error) return { error: error.message }

  const profiles = { data: await getCachedAllProfiles() }
  const nameMap = new Map((profiles.data ?? []).map(p => [p.id, p.display_name ?? 'Member']))

  const rows = (txns ?? []).map(t => ({
    date: t.date,
    member: t.member_id ? (nameMap.get(t.member_id) ?? 'Unknown') : 'Unattributed',
    description: t.description,
    amount: t.amount,
  }))

  return { data: rows }
}
