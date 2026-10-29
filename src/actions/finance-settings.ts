'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext, requireWorkspaceId } from '@/lib/workspace'
import { normaliseFinanceSettings, type FinanceSettings } from '@/lib/finance/settings'
import type { RecurringFrequency } from '@/lib/finance/recurring'
import type { Json } from '@/types/database'

function revalidateFinance() {
  revalidatePath('/finance', 'layout')
  revalidatePath('/settings', 'layout')
  revalidatePath('/shows', 'layout')
  revalidatePath('/')
}

/** Saves the whole money settings object. Admins only; the database checks this again. */
export async function saveFinanceSettings(input: FinanceSettings): Promise<{ error?: string }> {
  const ctx = await getWorkspaceContext()
  if (!ctx) return { error: 'Not authenticated' }
  const { workspace, role } = ctx.current
  if (role !== 'owner' && role !== 'admin') return { error: 'Only a workspace admin can change money settings.' }

  const settings = normaliseFinanceSettings(input)
  const supabase = await createClient()
  const raw = workspace.settings && typeof workspace.settings === 'object' && !Array.isArray(workspace.settings) ? (workspace.settings as Record<string, unknown>).finance : undefined
  const before = normaliseFinanceSettings(raw)
  const wasApproving = before.features.approvals
  // Accounts that hold entries can't be switched off, or the band's money would vanish from view.
  if (before.features.accounts && !settings.features.accounts) {
    const { count } = await supabase.from('finance_transactions').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id).not('account_id', 'is', null)
    if (count) return { error: 'Band accounts hold entries, so they can’t be switched off. You can archive an account to hide it from new entries.' }
  }
  const { error } = await supabase.rpc('set_finance_settings', { p_ws: workspace.id, p_settings: settings as unknown as Json })
  if (error) return { error: error.message }
  if (wasApproving && !settings.features.approvals) {
    await supabase.rpc('approve_all_finance_requests', { p_ws: workspace.id })
  }
  revalidateFinance()
  return {}
}

/** Renames a tag on every entry, or removes it when `next` is empty. */
export async function renameFinanceTag(previous: string, next: string | null): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('rename_finance_tag', { p_ws: await requireWorkspaceId(), p_old: previous, p_new: next })
  if (error) return { error: error.message }
  revalidateFinance()
  return {}
}

// Projects ---------------------------------------------------------------------------

export interface ProjectInput {
  name: string
  start_date?: string | null
  end_date?: string | null
  budget?: number | null
}

function checkProject(p: ProjectInput): string | null {
  if (!p.name?.trim()) return 'Give the project a name.'
  if (p.name.trim().length > 80) return 'Keep the name under 80 characters.'
  if (p.start_date && p.end_date && p.end_date < p.start_date) return 'The end date is before the start date.'
  if (p.budget != null && (!Number.isFinite(p.budget) || p.budget < 0)) return 'The budget can’t be negative.'
  return null
}

export async function createProject(p: ProjectInput): Promise<{ error?: string; id?: string }> {
  const problem = checkProject(p)
  if (problem) return { error: problem }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('finance_projects')
    .insert({ workspace_id: await requireWorkspaceId(), name: p.name.trim(), start_date: p.start_date || null, end_date: p.end_date || null, budget: p.budget ?? null })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidateFinance()
  return { id: data.id }
}

export async function updateProject(id: string, p: ProjectInput): Promise<{ error?: string }> {
  const problem = checkProject(p)
  if (problem) return { error: problem }
  const supabase = await createClient()
  const { error } = await supabase
    .from('finance_projects')
    .update({ name: p.name.trim(), start_date: p.start_date || null, end_date: p.end_date || null, budget: p.budget ?? null })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidateFinance()
  return {}
}

export async function setProjectArchived(id: string, archived: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('finance_projects').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id)
  if (error) return { error: error.message }
  revalidateFinance()
  return {}
}

/** Deletes a project. Its entries stay; they just no longer belong to a project. */
export async function deleteProject(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('finance_projects').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidateFinance()
  return {}
}

// Recurring entries ------------------------------------------------------------------

export interface RecurringInput {
  description: string
  amount: number
  category?: string | null
  member_id?: string | null
  project_id?: string | null
  frequency: RecurringFrequency
  start_date: string
  end_date?: string | null
}

function checkRecurring(r: RecurringInput): string | null {
  if (!r.description?.trim()) return 'Say what this is for.'
  if (!Number.isFinite(r.amount) || r.amount === 0) return 'Enter an amount.'
  if (!['weekly', 'monthly', 'yearly'].includes(r.frequency)) return 'Pick how often it repeats.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.start_date)) return 'Pick a start date.'
  if (r.end_date && r.end_date < r.start_date) return 'The end date is before the start date.'
  return null
}

export async function createRecurring(r: RecurringInput): Promise<{ error?: string }> {
  const problem = checkRecurring(r)
  if (problem) return { error: problem }
  const supabase = await createClient()
  const { error } = await supabase.from('finance_recurring').insert({
    workspace_id: await requireWorkspaceId(),
    description: r.description.trim(),
    amount: r.amount,
    category: r.category || null,
    member_id: r.member_id || null,
    project_id: r.project_id || null,
    frequency: r.frequency,
    start_date: r.start_date,
    end_date: r.end_date || null,
  })
  if (error) return { error: error.message }
  revalidateFinance()
  return {}
}

export async function updateRecurring(id: string, r: RecurringInput): Promise<{ error?: string }> {
  const problem = checkRecurring(r)
  if (problem) return { error: problem }
  const supabase = await createClient()
  const { error } = await supabase.from('finance_recurring').update({
    description: r.description.trim(),
    amount: r.amount,
    category: r.category || null,
    member_id: r.member_id || null,
    project_id: r.project_id || null,
    frequency: r.frequency,
    start_date: r.start_date,
    end_date: r.end_date || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidateFinance()
  return {}
}

export async function setRecurringPaused(id: string, paused: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('finance_recurring').update({ paused }).eq('id', id)
  if (error) return { error: error.message }
  revalidateFinance()
  return {}
}

/** Stops a rule for good. Entries it already added stay in the history. */
export async function deleteRecurring(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('finance_recurring').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidateFinance()
  return {}
}

/** Marks a show's fee as received, from the "Waiting to be paid" list. */
export async function markFeeReceived(showId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('shows').update({ fee_received: true }).eq('id', showId)
  if (error) return { error: error.message }
  revalidateFinance()
  return {}
}
