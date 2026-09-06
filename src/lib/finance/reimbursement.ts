// The floor-protection rule for a show expense someone pays out of pocket:
// only reimburse the shortfall that would otherwise take their own standing
// balance below zero — never the full amount by default. If their existing
// balance can absorb it, no reimbursement flows at all; it's just an
// ordinary debit against what's already theirs.
//
// This is checked eagerly, at the moment the expense is logged (see
// addTransaction in actions/finance.ts) — not deferred to split time — so a
// member's balance never actually sits negative because of a show expense
// they fronted.
export function computeAutoReimbursement(currentBalance: number, debitAmount: number): number {
  const balanceAfterDebit = currentBalance - debitAmount
  return balanceAfterDebit < 0 ? round2(-balanceAfterDebit) : 0
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
