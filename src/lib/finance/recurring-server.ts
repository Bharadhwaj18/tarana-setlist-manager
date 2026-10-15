import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/shows'
import { occurrences, type RecurringFrequency } from '@/lib/finance/recurring'
import type { FinanceRecurring } from '@/types/finance'

/**
 * Adds any recurring entries that have fallen due since the last visit. Runs when Finance is opened,
 * as the person opening it. If they can only view Finance the insert is refused and nothing happens;
 * the next person with edit access catches it up. A unique (rule, date) key means two people opening
 * Finance at once can't add the same entry twice.
 */
export async function catchUpRecurring(rules: FinanceRecurring[]): Promise<number> {
  const active = rules.filter(r => !r.paused)
  if (active.length === 0) return 0
  const today = todayISO()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { data: existing } = await supabase
    .from('finance_transactions')
    .select('recurring_id, date')
    .in('recurring_id', active.map(r => r.id))
  const have = new Set((existing ?? []).map(e => `${e.recurring_id}|${e.date}`))

  const rows = active.flatMap(r =>
    occurrences({ frequency: r.frequency as RecurringFrequency, start_date: r.start_date, end_date: r.end_date }, today)
      .filter(date => !have.has(`${r.id}|${date}`))
      .map(date => ({
        workspace_id: r.workspace_id,
        recurring_id: r.id,
        date,
        amount: r.amount,
        description: r.description,
        category: r.category,
        member_id: r.member_id ?? r.created_by,
        project_id: r.project_id,
        recorded_by: user.id,
      }))
  )
  if (rows.length === 0) return 0

  const { error } = await supabase.from('finance_transactions').upsert(rows, { onConflict: 'recurring_id,date', ignoreDuplicates: true })
  return error ? 0 : rows.length
}
