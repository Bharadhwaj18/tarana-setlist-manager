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
  shows: Show[]
  budgets: Budget[]
  projects: FinanceProject[]
  knownTags: string[]
  accounts: FinanceAccount[]
}

/**
 * Everything the add-money form needs, fetched when someone taps the quick-add button on a page that isn't Finance.
 * Loaded on demand so ordinary pages don't pay for it.
 */
export async function loadQuickAddData(): Promise<QuickAddData | { error: string }> {
  const ctx = await getWorkspaceContext()
  if (!ctx) return { error: 'Not authenticated' }
  if (ctx.current.sections.finance !== 'edit') return { error: 'You can only view money in this workspace.' }
  const ws = ctx.current.workspace.id

  const supabase = await createClient()
  const [{ data: { user } }, profiles, settings, projects, allAccounts, { data: shows }, { data: budgets }, { data: tagRows }] = await Promise.all([
    getCachedUser(),
    getCachedAllProfiles(),
    getCachedFinanceSettings(),
    getCachedFinanceProjects(),
    getCachedFinanceAccounts(),
    supabase.from('shows').select('*').eq('workspace_id', ws).is('split_at', null).order('show_date', { ascending: false }),
    supabase.from('budgets').select('*').eq('workspace_id', ws).eq('status', 'active').order('created_at', { ascending: true }),
    supabase.from('finance_transactions').select('tags').eq('workspace_id', ws).not('tags', 'eq', '{}').order('created_at', { ascending: false }).limit(300),
  ])

  const members = profiles
    .map(p => ({ id: p.id, name: p.id === user?.id ? 'You' : (p.display_name ?? 'Member'), isYou: p.id === user?.id }))
    .sort((a, b) => Number(b.isYou) - Number(a.isYou))
  const knownTags = [...new Set((tagRows ?? []).flatMap(r => r.tags ?? []))]

  return {
    workspaceId: ws,
    members,
    shows: shows ?? [],
    budgets: budgets ?? [],
    projects,
    knownTags,
    accounts: settings.features.accounts ? allAccounts : [],
  }
}
