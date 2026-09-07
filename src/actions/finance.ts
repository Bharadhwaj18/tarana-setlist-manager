'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireTreasurer(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  if (profile?.role !== 'treasurer') return 'Only a treasurer can do this.'
  return null
}

interface TransactionInput {
  member_id: string | null
  amount: number
  description: string
  category?: string | null
  show_id?: string | null
  date?: string
}

/**
 * Shared by add and update: a Misc debit (no show tag) still can't take a
 * member below zero — there's no show pool to eventually cover the gap. A
 * show-tagged expense CAN go negative temporarily: the reimbursement floor
 * is resolved when that show is split (see lib/finance/settlement.ts), not
 * blocked up front. `excludeTransactionId` backs a transaction's own current
 * amount out of the balance check when editing it, not just adding it.
 */
async function validateTransactionWrite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  data: TransactionInput,
  excludeTransactionId?: string
): Promise<string | null> {
  if (data.amount < 0 && data.member_id && !data.show_id) {
    const { data: txns } = await supabase
      .from('finance_transactions')
      .select('id, amount')
      .eq('member_id', data.member_id)
    const balance = (txns ?? [])
      .filter(t => t.id !== excludeTransactionId)
      .reduce((s, t) => s + t.amount, 0)
    if (balance + data.amount < 0) {
      return `Insufficient balance. Current balance: ₹${balance.toLocaleString('en-IN')}`
    }
  }

  // A show that's already been split is locked — redirect this to a Misc
  // expense instead of reopening the split (per the decided policy).
  if (data.show_id) {
    const { data: show } = await supabase.from('finance_shows').select('split_at').eq('id', data.show_id).maybeSingle()
    if (show?.split_at) {
      return 'This show has already been split. Log this as a Misc expense instead.'
    }
  }

  return null
}

export async function addTransaction(data: TransactionInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // "Paid by / Received by" is optional in the form — Band Fund was removed
  // as a choice there entirely (it never physically holds cash), so a blank
  // selection unambiguously means "whoever's submitting this."
  data = { ...data, member_id: data.member_id ?? user.id }

  const validationError = await validateTransactionWrite(supabase, data)
  if (validationError) return { error: validationError }

  const { error } = await supabase.from('finance_transactions').insert({
    ...data,
    date: data.date ?? new Date().toISOString().slice(0, 10),
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

  data = { ...data, member_id: data.member_id ?? user.id }

  const validationError = await validateTransactionWrite(supabase, data, id)
  if (validationError) return { error: validationError }

  const { error } = await supabase.from('finance_transactions').update({
    ...data,
    date: data.date ?? new Date().toISOString().slice(0, 10),
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finance')
  revalidatePath('/finance/split')
  revalidatePath('/finance/history')
  return {}
}

export async function deleteTransaction(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('finance_transactions').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finance')
  revalidatePath('/finance/split')
  revalidatePath('/finance/history')
  return {}
}

export async function addShow(data: {
  title: string
  show_date?: string | null
  venue?: string | null
}): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: inserted, error } = await supabase
    .from('finance_shows')
    .insert({ ...data, created_by: user.id })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/finance')
  revalidatePath('/finance/split')
  return { id: inserted?.id }
}

export async function deleteShow(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('finance_shows').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finance')
  revalidatePath('/finance/split')
  return {}
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
 * assignment) becomes exactly one debit transaction on the payer. Nobody is
 * ever credited: this section only tracks Band Fund, and money paid out to
 * someone becomes their personal money the instant it's paid, out of scope
 * from then on. A self-payment (from === to, someone covering their own
 * share from their own Band Fund) is written the exact same way as any
 * other payment.
 */
export async function splitShows(shows: ShowSplitInput[], payments: SplitPayment[]): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const permissionError = await requireTreasurer(supabase, user.id)
  if (permissionError) return { error: permissionError }

  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  // Only tie transactions to a specific show when there's exactly one in
  // this batch — a pooled multi-show payment isn't any single show's alone.
  const showId = shows.length === 1 ? shows[0].showId : null

  const transactions = payments
    .filter(p => p.amount > 0)
    .map(p => ({
      member_id: p.from,
      amount: -p.amount,
      description: p.description,
      category: 'split',
      show_id: showId,
      date: today,
      recorded_by: user.id,
    }))

  if (transactions.length > 0) {
    const { error: txErr } = await supabase.from('finance_transactions').insert(transactions)
    if (txErr) return { error: txErr.message }
  }

  const { error: showErr } = await supabase
    .from('finance_shows')
    .update({ split_at: now })
    .in('id', shows.map(s => s.showId))

  if (showErr) return { error: showErr.message }

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
    .order('date', { ascending: false })

  if (filters.dateFrom) query = query.gte('date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('date', filters.dateTo)
  if (filters.memberId === 'fund') query = query.is('member_id', null)
  else if (filters.memberId && filters.memberId !== 'all') query = query.eq('member_id', filters.memberId)

  const { data: txns, error } = await query
  if (error) return { error: error.message }

  const profiles = await supabase.from('profiles').select('id, display_name')
  const nameMap = new Map((profiles.data ?? []).map(p => [p.id, p.display_name ?? 'Member']))

  const rows = (txns ?? []).map(t => ({
    date: t.date,
    member: t.member_id ? (nameMap.get(t.member_id) ?? 'Unknown') : 'Unattributed',
    description: t.description,
    amount: t.amount,
  }))

  return { data: rows }
}
