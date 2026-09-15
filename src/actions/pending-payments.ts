'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/shows'

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

  if (pending.from_member !== user.id) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'treasurer') return { error: 'Only the payer (or a treasurer) can mark this paid.' }
  }

  const { data: txn, error: txErr } = await supabase
    .from('finance_transactions')
    .insert({
      member_id: pending.from_member,
      amount: -pending.amount,
      description: pending.description,
      category: pending.category,
      show_id: pending.show_id,
      date: todayISO(),
      recorded_by: user.id,
    })
    .select('id')
    .single()
  if (txErr) return { error: txErr.message }

  const { error: updateErr } = await supabase
    .from('pending_payments')
    .update({ paid_at: new Date().toISOString(), paid_transaction_id: txn.id })
    .eq('id', id)
  if (updateErr) return { error: updateErr.message }

  revalidatePath('/finance')
  revalidatePath('/finance/history')
  revalidatePath('/finance/split-history')
  return {}
}
