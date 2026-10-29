// Balance checks: comparing what an account holds in the app with what the bank shows.

const round2 = (n: number) => Math.round(n * 100) / 100

/** Bank minus the app: positive means the bank has more than the app knows about. */
export const balanceDifference = (bank: number, recorded: number) => round2(bank - recorded) + 0 // + 0 turns -0 into 0

export interface BalanceCheck {
  id: string
  accountId: string
  checkedOn: string
  bank: number
  recorded: number
  difference: number
  note: string | null
  corrected: boolean
  checkedBy: string
  createdAt: string
}

interface CheckRow {
  id: string; account_id: string; checked_on: string; bank_balance: number; recorded_balance: number
  difference: number; note: string | null; adjustment_id: string | null; checked_by: string; created_at: string
}

export function toCheck(r: CheckRow): BalanceCheck {
  return {
    id: r.id, accountId: r.account_id, checkedOn: r.checked_on, bank: r.bank_balance, recorded: r.recorded_balance,
    difference: r.difference, note: r.note, corrected: r.adjustment_id !== null, checkedBy: r.checked_by, createdAt: r.created_at,
  }
}

/** Days from a check's date to today (both YYYY-MM-DD), never negative. */
export function daysSince(date: string, today: string): number {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)
  return Math.max(0, Math.round(ms / 86_400_000))
}

export type CheckState = 'never' | 'matched' | 'off' | 'fixed' | 'stale'

/** How an account stands: never checked, matched, off by something not yet fixed, fixed, or checked too long ago. */
export function checkState(last: BalanceCheck | undefined, today: string, staleAfterDays = 30): CheckState {
  if (!last) return 'never'
  if (daysSince(last.checkedOn, today) > staleAfterDays) return 'stale'
  if (last.difference === 0) return 'matched'
  return last.corrected ? 'fixed' : 'off'
}

/** The latest check per account (newest by date, then by when it was saved). */
export function latestChecks(checks: BalanceCheck[]): Record<string, BalanceCheck> {
  const out: Record<string, BalanceCheck> = {}
  for (const c of checks) {
    const cur = out[c.accountId]
    if (!cur || c.checkedOn > cur.checkedOn || (c.checkedOn === cur.checkedOn && c.createdAt > cur.createdAt)) out[c.accountId] = c
  }
  return out
}
