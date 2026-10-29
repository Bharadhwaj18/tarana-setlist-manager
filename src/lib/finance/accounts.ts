// Finance accounts: real places the band's money is (a bank account, a cash box), next to members' pockets.
// An entry belongs to a member OR to an account, never both.

export const MAX_ACCOUNTS = 5

export type AccountKind = 'bank' | 'cash'

export interface FinanceAccount {
  id: string
  name: string
  kind: AccountKind
  /** The member whose name it's in or who carries it. Null: the band itself. Information only. */
  heldBy: string | null
  upiId: string | null
  archived: boolean
}

/** Forms and filters carry an account as "acct:<id>" so it can sit in the same list as member ids. */
export const ACCOUNT_PREFIX = 'acct:'
export const accountValue = (id: string) => `${ACCOUNT_PREFIX}${id}`
export const isAccountValue = (value: string) => value.startsWith(ACCOUNT_PREFIX)
export function accountIdOf(value: string): string | null {
  return isAccountValue(value) ? value.slice(ACCOUNT_PREFIX.length) || null : null
}

interface AccountRow { id: string; name: string; kind: string; held_by: string | null; upi_id: string | null; archived_at: string | null }

export function toAccount(row: AccountRow): FinanceAccount {
  return { id: row.id, name: row.name, kind: row.kind === 'cash' ? 'cash' : 'bank', heldBy: row.held_by, upiId: row.upi_id, archived: row.archived_at !== null }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** What each account holds: the sum of its entries. */
export function accountBalances(entries: { amount: number; account_id: string | null }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of entries) {
    if (e.account_id) out[e.account_id] = round2((out[e.account_id] ?? 0) + e.amount)
  }
  return out
}

/** Accounts that can still take entries, in the order they were made. */
export const activeAccounts = (accounts: FinanceAccount[]) => accounts.filter(a => !a.archived)

/** Accounts as entries for a member picker (export filter), when the feature is on. */
export function accountPickerOptions(accounts: FinanceAccount[]): { id: string; name: string }[] {
  return accounts.map(a => ({ id: accountValue(a.id), name: `${a.name} (account)` }))
}

/** The name to show for whoever an entry belongs to: its account, else its member. */
export function holderName(
  entry: { account_id: string | null; member_id: string | null },
  accounts: FinanceAccount[],
  memberName: (id: string | null) => string,
): string {
  if (entry.account_id) return accounts.find(a => a.id === entry.account_id)?.name ?? 'Account'
  return memberName(entry.member_id)
}
