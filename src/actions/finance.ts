'use server'

import { formatMoney } from '@/lib/finance/settings'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/shows'
import { getCachedAllProfiles, getCachedFinanceAccounts, getCachedFinanceSettings } from '@/lib/data'
import { accountIdOf, isAccountValue } from '@/lib/finance/accounts'
import { getWorkspaceContext, isCurrentTreasurer, isFinanceApprover, requireWorkspaceId } from '@/lib/workspace'
import { sendNotification, sendNotificationToAll } from '@/actions/notifications'
import type { Json } from '@/types/database'
import type { SplitRunReport, SplitRunPayment, SplitRunShow } from '@/types/split-run'

/** An amount in the workspace's currency, for notification text. */
async function moneyText(n: number) {
  return formatMoney(n, (await getCachedFinanceSettings()).currency)
}

async function requireTreasurer(): Promise<string | null> {
  if (!(await isCurrentTreasurer())) return 'Only a treasurer can do this.'
  return null
}

interface TransactionInput {
  /** A member's pocket. Null with an account_id: the entry belongs to that account instead. */
  member_id: string | null
  /** A band account (bank account, cash box). Never together with a member. */
  account_id?: string | null
  amount: number
  description: string
  category?: string | null
  show_id?: string | null
  budget_id?: string | null
  date?: string
  tags?: string[]
  project_id?: string | null
}

/**
 * The account column for a write. Sent only when an account is involved (or when accounts are on and an entry is
 * moving back to a member), so a workspace that never uses accounts never touches the column.
 */
function accountColumn(accountId: string | null | undefined, accountsOn: boolean): { account_id?: string | null } {
  if (accountId) return { account_id: accountId }
  return accountsOn ? { account_id: null } : {}
}

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
  data: TransactionInput
): Promise<string | null> {
  if (data.tags && (data.tags.length > 10 || data.tags.some(t => typeof t !== 'string' || !t.trim() || t.length > 40))) {
    return 'Use up to 10 tags, each under 40 characters.'
  }

  if (data.account_id) {
    if (!(await getCachedFinanceSettings()).features.accounts) return 'Band accounts are switched off for this workspace.'
    if (data.category === 'reimbursement') return 'A reimbursement is paid back to a person, not an account.'
    const { data: account } = await supabase.from('finance_accounts').select('archived_at').eq('id', data.account_id).maybeSingle()
    if (!account) return 'That account is no longer there.'
    if (account.archived_at) return 'That account is archived. Pick another, or bring it back first.'
  }

  // A budget only ever tracks Misc spending: a debit with no show attached.
  if (data.budget_id && (data.amount >= 0 || data.show_id || data.category === 'reimbursement')) {
    return 'Only Misc expenses (not show-related, not a credit) can be tagged to a budget.'
  }

  // A show that's already been split is locked — redirect this to a Misc
  // expense instead of reopening the split (per the decided policy).
  if (data.show_id) {
    const { data: show } = await supabase.from('shows').select('split_at').eq('id', data.show_id).maybeSingle()
    if (show?.split_at) {
      return 'This show has already been split. Log this as a Misc expense instead.'
    }
  }

  return null
}

/** With approval on, is this person's entry going to wait for an admin or treasurer? */
async function needsApproval(): Promise<boolean> {
  const [ctx, settings] = await Promise.all([getWorkspaceContext(), getCachedFinanceSettings()])
  return !!ctx && settings.features.approvals && !isFinanceApprover(ctx.current)
}

const APPROVAL_ONLY = 'While treasurer approval is on, only an admin or treasurer can change or delete entries.'

/** Owners, admins and treasurers: the people who run the band's accounts. */
async function isApprover(): Promise<boolean> {
  const ctx = await getWorkspaceContext()
  return !!ctx && isFinanceApprover(ctx.current)
}
const ACCOUNT_ONLY = 'Only an admin or treasurer can change what’s in an account.'

export async function addTransaction(data: TransactionInput): Promise<{ error?: string; pending?: boolean; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // "Paid by / Received by" is optional in the form — Band Fund was removed
  // as a choice there entirely (it never physically holds cash), so a blank
  // selection unambiguously means "whoever's submitting this."
  data = { ...data, account_id: data.account_id ?? null, member_id: data.account_id ? null : data.member_id ?? user.id }

  const validationError = await validateTransactionWrite(supabase, data)
  if (validationError) return { error: validationError }

  // Entries in an account are the treasurer's to make. Anyone else can ask: it always waits for approval,
  // whether or not treasurer approval is switched on.
  if ((await needsApproval()) || (data.account_id && !(await isApprover()))) return submitForApproval(supabase, user.id, data)
  const { account_id: addAccountId, ...addRow } = data

  const { data: inserted, error } = await supabase.from('finance_transactions').insert({
    ...addRow,
    ...accountColumn(addAccountId, false),
    workspace_id: await requireWorkspaceId(),
    date: data.date ?? todayISO(),
    recorded_by: user.id,
  }).select('id').single()
  if (error) return { error: error.message }

  // Money coming in is worth telling the whole band about — an expense
  // (negative amount) isn't, that's just routine bookkeeping.
  if (data.amount > 0) {
    const { data: actor } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
    await sendNotificationToAll({
      title: `${actor?.display_name ?? 'Someone'} logged a credit of ${await moneyText(data.amount)}`,
      body: data.description,
      link: '/finance',
      type: 'transaction_credit',
    })
  }

  revalidatePath('/finance')
  revalidatePath('/finance/split')
  revalidatePath('/finance/history')
  return { id: inserted.id }
}

/**
 * Puts back an entry that was just deleted (the "Undo" on the delete toast). Same rules as a new entry, but it
 * doesn't tell the band about it a second time, and it never waits for approval: only people who could delete it can undo it.
 */
export async function restoreTransaction(data: TransactionInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (await needsApproval()) return { error: APPROVAL_ONLY }
  if (data.account_id && !(await isApprover())) return { error: ACCOUNT_ONLY }

  data = { ...data, account_id: data.account_id ?? null, member_id: data.account_id ? null : data.member_id ?? user.id }
  const validationError = await validateTransactionWrite(supabase, data)
  if (validationError) return { error: validationError }

  const { account_id: restoreAccountId, ...restoreRow } = data
  const { error } = await supabase.from('finance_transactions').insert({
    ...restoreRow,
    ...accountColumn(restoreAccountId, false),
    workspace_id: await requireWorkspaceId(),
    date: data.date ?? todayISO(),
    recorded_by: user.id,
  })
  if (error) return { error: error.message }

  revalidatePath('/finance')
  revalidatePath('/finance/split')
  revalidatePath('/finance/history')
  return {}
}

export async function updateTransaction(id: string, data: TransactionInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (await needsApproval()) return { error: APPROVAL_ONLY }
  if (data.account_id && !(await isApprover())) return { error: 'Only an admin or treasurer can put an entry in an account. Add it as a new entry and it waits for approval.' }

  data = { ...data, account_id: data.account_id ?? null, member_id: data.account_id ? null : data.member_id ?? user.id }

  const validationError = await validateTransactionWrite(supabase, data)
  if (validationError) return { error: validationError }

  const { data: existing } = await supabase.from('finance_transactions').select('transfer_id, account_id').eq('id', id).maybeSingle()
  if (existing?.transfer_id) return { error: 'A move can’t be edited. Undo it and move the money again.' }
  if (existing?.account_id && !(await isApprover())) return { error: ACCOUNT_ONLY }

  const { account_id: updateAccountId, ...updateRow } = data
  const accountsOn = (await getCachedFinanceSettings()).features.accounts
  const { error } = await supabase.from('finance_transactions').update({
    ...updateRow,
    ...accountColumn(updateAccountId, accountsOn),
    date: data.date ?? todayISO(),
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finance')
  revalidatePath('/finance/split')
  revalidatePath('/finance/history')
  return {}
}

export async function deleteTransaction(id: string): Promise<{ error?: string }> {
  if (await needsApproval()) return { error: APPROVAL_ONLY }
  const supabase = await createClient()
  // Undoing one side of a move undoes both, so the two never get out of step. (No transfer column yet: plain delete.)
  const { data: row } = await supabase.from('finance_transactions').select('transfer_id, account_id').eq('id', id).maybeSingle()
  if ((row?.account_id || row?.transfer_id) && !(await isApprover())) return { error: ACCOUNT_ONLY }
  const del = supabase.from('finance_transactions').delete()
  const { error } = row?.transfer_id ? await del.eq('transfer_id', row.transfer_id) : await del.eq('id', id)
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
  /** who's paying — gets debited. A member id, or "acct:<id>" when a band account pays. */
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

  const workspaceId = await requireWorkspaceId()

  // A payout from a band account waits to be marked paid, like any other. The account must be this workspace's and open.
  const accounts = await getCachedFinanceAccounts()
  for (const p of payments) {
    const id = accountIdOf(p.from)
    if (isAccountValue(p.from) && !accounts.some(a => a.id === id && !a.archived)) return { error: 'One of the accounts paying out is archived or missing.' }
  }

  const now = new Date().toISOString()
  const today = todayISO()
  // Only tie transactions to a specific show when there's exactly one in
  // this batch — a pooled multi-show payment isn't any single show's alone.
  const showId = shows.length === 1 ? shows[0].showId : null

  const real = payments.filter(p => p.amount > 0)
  const selfPayments = real.filter(p => p.from === p.to)
  const crossPayments = real.filter(p => p.from !== p.to)

  if (selfPayments.length > 0) {
    const transactions = selfPayments.map(p => ({
      member_id: p.from,
      amount: -p.amount,
      description: p.description,
      category: 'split',
      show_id: showId,
      date: today,
      recorded_by: user.id,
      workspace_id: workspaceId,
    }))
    const { error: txErr } = await supabase.from('finance_transactions').insert(transactions)
    if (txErr) return { error: txErr.message }
  }

  let pendingIds: string[] = []
  if (crossPayments.length > 0) {
    const pending = crossPayments.map(p => ({
      from_member: isAccountValue(p.from) ? null : p.from,
      from_account: accountIdOf(p.from),
      to_member: p.to,
      amount: p.amount,
      description: p.description,
      category: 'split',
      show_id: showId,
      workspace_id: workspaceId,
    }))
    const { data: insertedPending, error: pendingErr } = await supabase.from('pending_payments').insert(pending).select('id')
    if (pendingErr) return { error: pendingErr.message }
    pendingIds = (insertedPending ?? []).map(r => r.id)

    for (const [i, p] of crossPayments.entries()) {
      if (p.from === user.id || isAccountValue(p.from)) continue // don't ping yourself about your own debt; an account has no one to ping
      await sendNotification({
        recipientId: p.from,
        title: `You owe ${await moneyText(p.amount)}`,
        body: p.description,
        // Carries the payment, so the notification itself can offer "Mark paid".
        link: pendingIds[i] ? `/finance?pay=${pendingIds[i]}` : '/finance',
        type: 'payment_owed',
      })
    }
  }

  const { error: showErr } = await supabase
    .from('shows')
    .update({ split_at: now })
    .in('id', shows.map(s => s.showId))

  if (showErr) return { error: showErr.message }

  // Freeze this run — the full report plus who pays whom — so Split History
  // is a record of the split itself, not a re-derivation from live data.
  const ids = [...new Set(payments.flatMap(p => [p.from, p.to]))].filter(id => !isAccountValue(id))
  const { data: people } = await supabase.from('profiles').select('id, display_name').in('id', ids)
  const nameOf = (id: string) => isAccountValue(id)
    ? (accounts.find(a => a.id === accountIdOf(id))?.name ?? 'Account')
    : (people?.find(p => p.id === id)?.display_name ?? 'Member')
  let crossIndex = 0
  const runPayments: SplitRunPayment[] = real.map(p =>
    p.from === p.to
      ? { from: p.from, to: p.to, fromName: nameOf(p.from), toName: nameOf(p.to), amount: p.amount, kind: 'self' as const }
      : { from: p.from, to: p.to, fromName: nameOf(p.from), toName: nameOf(p.to), amount: p.amount, kind: 'transfer' as const, pendingId: pendingIds[crossIndex++] }
  )
  const { data: showRows } = await supabase.from('shows').select('id, title, show_date').in('id', shows.map(s => s.showId))
  const runShows: SplitRunShow[] = report.shows.map((rs, i) => {
    const row = showRows?.find(r => r.id === shows[i]?.showId)
    return { id: shows[i]?.showId ?? '', title: rs.showTitle, date: row?.show_date ?? null, net: rs.net }
  })
  const { error: runErr } = await supabase.from('split_runs').insert({
    created_at: now,
    created_by: user.id,
    workspace_id: workspaceId,
    band_pct: report.bandPct,
    total_net: report.totalNet,
    total_band_fund: report.totalBandFund,
    shows: runShows as unknown as Json,
    payments: runPayments as unknown as Json,
    report: report as unknown as Json,
  })
  if (runErr) return { error: runErr.message }

  revalidatePath('/finance')
  revalidatePath('/finance/split')
  redirect('/finance')
}

export async function exportTransactions(filters: {
  dateFrom?: string
  dateTo?: string
  memberId?: string | 'all' | 'fund'
}): Promise<{ data?: { date: string; member: string; description: string; amount: number }[]; error?: string }> {
  const accounts = await getCachedFinanceAccounts()
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
  const accountFilter = filters.memberId ? accountIdOf(filters.memberId) : null
  if (accountFilter) query = query.eq('account_id', accountFilter)
  else if (filters.memberId === 'fund') query = query.is('member_id', null).is('account_id', null)
  else if (filters.memberId && filters.memberId !== 'all') query = query.eq('member_id', filters.memberId)

  const { data: txns, error } = await query
  if (error) return { error: error.message }

  const profiles = { data: await getCachedAllProfiles() }
  const nameMap = new Map((profiles.data ?? []).map(p => [p.id, p.display_name ?? 'Member']))

  const rows = (txns ?? []).map(t => ({
    date: t.date,
    member: t.account_id ? (accounts.find(a => a.id === t.account_id)?.name ?? 'Account') : t.member_id ? (nameMap.get(t.member_id) ?? 'Unknown') : 'Unattributed',
    description: t.description,
    amount: t.amount,
  }))

  return { data: rows }
}

// ---- Treasurer approval ------------------------------------------------------------------

async function approverIds(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string): Promise<string[]> {
  const { data } = await supabase.from('workspace_members').select('user_id, role, permissions').eq('workspace_id', workspaceId)
  return (data ?? [])
    .filter(m => m.role === 'owner' || m.role === 'admin' || (m.permissions && typeof m.permissions === 'object' && !Array.isArray(m.permissions) && (m.permissions as Record<string, unknown>).treasurer === true))
    .map(m => m.user_id)
}

async function submitForApproval(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, data: TransactionInput): Promise<{ error?: string; pending?: boolean }> {
  const workspaceId = await requireWorkspaceId()
  const { error } = await supabase.from('finance_requests').insert({
    workspace_id: workspaceId,
    submitted_by: userId,
    member_id: data.member_id,
    ...accountColumn(data.account_id, false),
    amount: data.amount,
    description: data.description,
    category: data.category ?? null,
    show_id: data.show_id ?? null,
    budget_id: data.budget_id ?? null,
    project_id: data.project_id ?? null,
    tags: data.tags ?? [],
    date: data.date ?? todayISO(),
  })
  if (error) return { error: /finance_requests/.test(error.message) ? 'Approvals aren’t switched on in the database yet. Run the finance approvals SQL first.' : error.message }

  const { data: actor } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle()
  const who = actor?.display_name ?? 'Someone'
  for (const id of await approverIds(supabase, workspaceId)) {
    if (id === userId) continue
    await sendNotification({
      recipientId: id,
      title: `${who} added ${await moneyText(data.amount)} for approval`,
      body: data.description,
      link: '/finance',
      type: 'finance_request',
    })
  }
  revalidatePath('/finance')
  return { pending: true }
}

/** An admin or treasurer approves a waiting entry: it becomes a normal entry and starts counting. */
export async function approveFinanceRequest(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: request } = await supabase.from('finance_requests').select('submitted_by, amount, description').eq('id', id).maybeSingle()
  const { error } = await supabase.rpc('approve_finance_request', { p_id: id })
  if (error) return { error: error.message }
  if (request) {
    await sendNotification({
      recipientId: request.submitted_by,
      title: `Approved: ${await moneyText(request.amount)}`,
      body: request.description,
      link: '/finance',
      type: 'finance_request_decided',
    })
  }
  revalidatePath('/finance', 'layout')
  return {}
}

/** An admin or treasurer turns a waiting entry down. The person who added it is told why. */
export async function rejectFinanceRequest(id: string, reason: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: request } = await supabase.from('finance_requests').select('submitted_by, amount, description').eq('id', id).maybeSingle()
  if (!request) return { error: 'That entry is no longer waiting.' }
  const { error } = await supabase.from('finance_requests').delete().eq('id', id)
  if (error) return { error: error.message }
  await sendNotification({
    recipientId: request.submitted_by,
    title: `Not approved: ${await moneyText(request.amount)} · ${request.description}`,
    body: reason.trim() || 'An admin or treasurer turned this entry down.',
    link: '/finance',
    type: 'finance_request_decided',
  })
  revalidatePath('/finance')
  return {}
}

/** Take back an entry you sent that hasn't been approved yet. */
export async function withdrawFinanceRequest(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('finance_requests').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finance')
  return {}
}
