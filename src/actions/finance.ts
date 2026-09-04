'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function addTransaction(data: {
  member_id: string | null
  amount: number
  description: string
  date?: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Prevent balance going below zero for member debits
  if (data.amount < 0 && data.member_id) {
    const { data: txns } = await supabase
      .from('finance_transactions')
      .select('amount')
      .eq('member_id', data.member_id)
    const balance = (txns ?? []).reduce((s, t) => s + t.amount, 0)
    if (balance + data.amount < 0) {
      return { error: `Insufficient balance. Current balance: ₹${balance.toLocaleString('en-IN')}` }
    }
  }

  const { error } = await supabase.from('finance_transactions').insert({
    ...data,
    date: data.date ?? new Date().toISOString().slice(0, 10),
    recorded_by: user.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/finance')
  return {}
}

export async function deleteTransaction(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('finance_transactions').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finance')
  return {}
}

export async function addShow(data: {
  title: string
  show_date?: string | null
  venue?: string | null
  gross_income: number
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('finance_shows').insert({ ...data, created_by: user.id })
  if (error) return { error: error.message }
  revalidatePath('/finance')
  return {}
}

export async function deleteShow(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('finance_shows').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finance')
  return {}
}

export async function addShowExpense(
  showId: string,
  data: {
    description: string
    amount: number
    paid_by: string
    category?: string
    date?: string
  }
): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const show = await supabase.from('finance_shows').select('split_at').eq('id', showId).single()
  if (show.data?.split_at) return { error: 'Cannot modify expenses for a show that has already been split' }

  const { data: inserted, error } = await supabase.from('finance_show_expenses').insert({
    show_id: showId,
    description: data.description,
    amount: data.amount,
    paid_by: data.paid_by,
    category: data.category ?? 'misc',
    date: data.date ?? new Date().toISOString().slice(0, 10),
    recorded_by: user.id,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/finance/split')
  return { id: inserted?.id }
}

export async function deleteShowExpense(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('finance_show_expenses').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finance/split')
  return {}
}

export async function splitShows(
  showIds: string[],
  bandPct: number,
  memberShares: { memberId: string | null; amount: number; description: string }[],
  adjustments?: { fromMemberId: string | null; toMemberId: string | null; amount: number; description: string }[]
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const now = new Date().toISOString()
  const today = now.slice(0, 10)

  const transactions = memberShares.map(({ memberId, amount, description }) => ({
    member_id: memberId,
    amount,
    description,
    show_id: showIds[0],
    date: today,
    recorded_by: user.id,
  }))

  if (adjustments?.length) {
    for (const adj of adjustments) {
      // Debit from source
      transactions.push({
        member_id: adj.fromMemberId,
        amount: -adj.amount,
        description: adj.description,
        show_id: showIds[0],
        date: today,
        recorded_by: user.id,
      })
      // Credit to recipient
      transactions.push({
        member_id: adj.toMemberId,
        amount: adj.amount,
        description: adj.description,
        show_id: showIds[0],
        date: today,
        recorded_by: user.id,
      })
    }
  }

  const { error: txErr } = await supabase.from('finance_transactions').insert(transactions)
  if (txErr) return { error: txErr.message }

  const { error: showErr } = await supabase
    .from('finance_shows')
    .update({ split_at: now })
    .in('id', showIds)

  if (showErr) return { error: showErr.message }

  revalidatePath('/finance')
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
    member: t.member_id ? (nameMap.get(t.member_id) ?? 'Unknown') : 'Band Fund',
    description: t.description,
    amount: t.amount,
  }))

  return { data: rows }
}

export async function importTransactions(
  rows: { date: string; description: string; amount: number }[]
): Promise<{ imported: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { imported: 0, error: 'Not authenticated' }

  const today = new Date().toISOString().slice(0, 10)

  const records = rows.map(r => ({
    member_id: null as string | null,
    amount: r.amount,
    description: r.description,
    date: r.date || today,
    recorded_by: user.id,
  }))

  // Batch in chunks of 100
  let imported = 0
  for (let i = 0; i < records.length; i += 100) {
    const chunk = records.slice(i, i + 100)
    const { error } = await supabase.from('finance_transactions').insert(chunk)
    if (error) return { imported, error: error.message }
    imported += chunk.length
  }

  revalidatePath('/finance')
  return { imported }
}
