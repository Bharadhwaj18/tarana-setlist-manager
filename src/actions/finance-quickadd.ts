'use server'

import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getCachedAllProfiles, getCachedFinanceAccounts, getCachedFinanceProjects, getCachedFinanceSettings, getCachedUser } from '@/lib/data'
import type { FinanceAccount } from '@/lib/finance/accounts'
import type { FinanceProject } from '@/types/finance'
import type { Show } from '@/types/shows'
import type { Budget } from '@/types/budget'

export interface QuickAddData {
  workspaceId: string
  members: { id: string; name: string; isYou?: boolean }[]
  /** Task boards, for "Add task". Empty without edit access to Tasks. */
  boards: { id: string; name: string }[]
  /** For "Add transaction". All empty without edit access to Finance. */
  shows: Show[]
  budgets: Budget[]
  projects: FinanceProject[]
  knownTags: string[]
  accounts: FinanceAccount[]
}

/**
 * Everything the quick-add forms need (the money form and the task form), fetched when someone taps the "+" button.
 * Loaded on demand so ordinary pages don't pay for it. Only what the person can edit is loaded.
 */
export async function loadQuickAddData(): Promise<QuickAddData | { error: string }> {
  const ctx = await getWorkspaceContext()
  if (!ctx) return { error: 'Not authenticated' }
  const ws = ctx.current.workspace.id
  const canMoney = ctx.current.sections.finance === 'edit'
  const canTasks = ctx.current.sections.tasks === 'edit'

  const supabase = await createClient()
  const [{ data: { user } }, profiles, settings, projects, allAccounts, shows, budgets, tagRows, boards] = await Promise.all([
    getCachedUser(),
    getCachedAllProfiles(),
    canMoney ? getCachedFinanceSettings() : null,
    canMoney ? getCachedFinanceProjects() : [],
    canMoney ? getCachedFinanceAccounts() : [],
    canMoney ? supabase.from('shows').select('*').eq('workspace_id', ws).is('split_at', null).order('show_date', { ascending: false }) : null,
    canMoney ? supabase.from('budgets').select('*').eq('workspace_id', ws).eq('status', 'active').order('created_at', { ascending: true }) : null,
    canMoney ? supabase.from('finance_transactions').select('tags').eq('workspace_id', ws).not('tags', 'eq', '{}').order('created_at', { ascending: false }).limit(300) : null,
    canTasks ? supabase.from('task_boards').select('id, name').eq('workspace_id', ws).is('archived_at', null).order('created_at') : null,
  ])

  const members = profiles
    .map(p => ({ id: p.id, name: p.id === user?.id ? 'You' : (p.display_name ?? 'Member'), isYou: p.id === user?.id }))
    .sort((a, b) => Number(b.isYou) - Number(a.isYou))
  const knownTags = [...new Set((tagRows?.data ?? []).flatMap(r => r.tags ?? []))]

  return {
    workspaceId: ws,
    members,
    boards: boards?.data ?? [],
    shows: shows?.data ?? [],
    budgets: budgets?.data ?? [],
    projects,
    knownTags,
    accounts: settings?.features.accounts ? allAccounts : [],
  }
}
