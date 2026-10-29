import type { FinanceTransaction } from '@/types/finance'

/** What it takes to put a deleted entry back: everything the add form saves, nothing that was generated. */
export function transactionToInput(t: FinanceTransaction) {
  return {
    member_id: t.member_id,
    account_id: t.account_id,
    amount: t.amount,
    description: t.description,
    category: t.category,
    show_id: t.show_id,
    budget_id: t.budget_id,
    date: t.date,
    tags: t.tags ?? [],
    project_id: t.project_id,
  }
}

/** The two sides of a move go together, so a move is undone from its own confirm, not with an Undo toast. */
export const canUndoDelete = (t: Pick<FinanceTransaction, 'transfer_id'>) => !t.transfer_id
