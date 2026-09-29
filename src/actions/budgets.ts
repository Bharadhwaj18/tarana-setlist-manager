'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/shows'
import { isCurrentTreasurer, requireWorkspaceId } from '@/lib/workspace'

type Supabase = Awaited<ReturnType<typeof createClient>>

async function requireTreasurer(): Promise<{ supabase: Supabase; userId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!(await isCurrentTreasurer())) return { error: 'Only a treasurer can manage budgets.' }
  return { supabase, userId: user.id }
}

function revalidate() {
  revalidatePath('/finance')
}

export interface BudgetInput {
  name: string
  allocated_amount: number
  recurrence: 'none' | 'monthly'
  start_date?: string
  end_date?: string | null
}

function validate(d: BudgetInput): string | null {
  if (!d.name.trim()) return 'Give the budget a name.'
  if (!Number.isFinite(d.allocated_amount) || d.allocated_amount < 0) return 'Enter a valid amount.'
  if (d.start_date && d.end_date && d.end_date < d.start_date) return 'End date can’t be before the start date.'
  return null
}

export async function createBudget(data: BudgetInput): Promise<{ error?: string; id?: string }> {
  const auth = await requireTreasurer()
  if ('error' in auth) return auth
  const invalid = validate(data)
  if (invalid) return { error: invalid }

  const { data: row, error } = await auth.supabase
    .from('budgets')
    .insert({
      name: data.name.trim(),
      allocated_amount: data.allocated_amount,
      recurrence: data.recurrence,
      start_date: data.start_date || todayISO(),
      end_date: data.end_date || null,
      created_by: auth.userId,
      workspace_id: await requireWorkspaceId(),
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await auth.supabase.from('budget_adjustments').insert({
    budget_id: row.id, kind: 'created', delta: data.allocated_amount, created_by: auth.userId,
  })
  revalidate()
  return { id: row.id }
}

/** Edits name / recurrence / dates. Allocation changes go through adjustBudgetAllocation so they're logged. */
export async function updateBudget(id: string, data: Omit<BudgetInput, 'allocated_amount'>): Promise<{ error?: string }> {
  const auth = await requireTreasurer()
  if ('error' in auth) return auth
  const invalid = validate({ ...data, allocated_amount: 0 })
  if (invalid) return { error: invalid }

  const { error } = await auth.supabase
    .from('budgets')
    .update({
      name: data.name.trim(),
      recurrence: data.recurrence,
      ...(data.start_date ? { start_date: data.start_date } : {}),
      end_date: data.end_date || null,
    })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidate()
  return {}
}

/** Positive delta tops up, negative reduces. Logged either way. */
export async function adjustBudgetAllocation(id: string, delta: number, note?: string): Promise<{ error?: string }> {
  const auth = await requireTreasurer()
  if ('error' in auth) return auth
  if (!Number.isFinite(delta) || delta === 0) return { error: 'Enter an amount.' }

  const { data: budget, error: fetchErr } = await auth.supabase.from('budgets').select('allocated_amount').eq('id', id).maybeSingle()
  if (fetchErr) return { error: fetchErr.message }
  if (!budget) return { error: 'This budget no longer exists.' }
  const next = Math.round((budget.allocated_amount + delta) * 100) / 100
  if (next < 0) return { error: 'Allocation can’t go below ₹0.' }

  const { error } = await auth.supabase.from('budgets').update({ allocated_amount: next }).eq('id', id)
  if (error) return { error: error.message }
  await auth.supabase.from('budget_adjustments').insert({
    budget_id: id, kind: delta > 0 ? 'top_up' : 'reduce', delta, note: note?.trim() || null, created_by: auth.userId,
  })
  revalidate()
  return {}
}

export async function setBudgetStatus(id: string, status: 'active' | 'closed'): Promise<{ error?: string }> {
  const auth = await requireTreasurer()
  if ('error' in auth) return auth
  const { error } = await auth.supabase.from('budgets').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  await auth.supabase.from('budget_adjustments').insert({
    budget_id: id, kind: status === 'closed' ? 'closed' : 'reopened', delta: 0, created_by: auth.userId,
  })
  revalidate()
  return {}
}

export async function deleteBudget(id: string): Promise<{ error?: string }> {
  const auth = await requireTreasurer()
  if ('error' in auth) return auth
  const { error } = await auth.supabase.from('budgets').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidate()
  return {}
}
