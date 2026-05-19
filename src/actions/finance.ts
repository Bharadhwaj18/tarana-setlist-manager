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

export async function splitShows(
  showIds: string[],
  bandPct: number,
  memberShares: { memberId: string | null; amount: number; description: string }[]
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
    show_id: showIds[0],  // link to first show for traceability
    date: today,
    recorded_by: user.id,
  }))

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
