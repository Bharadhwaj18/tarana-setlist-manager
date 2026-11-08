// Personal's money overview: what one person holds in each of their workspaces, and what they owe or are owed.

import { REIMBURSEMENT_KEY } from '@/lib/finance/settings'

const round2 = (n: number) => Math.round(n * 100) / 100

/** What the person holds per workspace: the sum of their own entries. A reimbursement is never held money, so it's left out. */
export function balancesByWorkspace(entries: { workspace_id: string | null; amount: number; category: string | null }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of entries) {
    if (!e.workspace_id || e.category === REIMBURSEMENT_KEY) continue
    out[e.workspace_id] = round2((out[e.workspace_id] ?? 0) + e.amount)
  }
  return out
}

/** One total per currency. Workspaces in different currencies are never added together. */
export function totalsByCurrency(rows: { currency: string; balance: number }[]): { currency: string; total: number }[] {
  const byCurrency = new Map<string, number>()
  for (const r of rows) byCurrency.set(r.currency, round2((byCurrency.get(r.currency) ?? 0) + r.balance))
  return [...byCurrency].map(([currency, total]) => ({ currency, total }))
}
