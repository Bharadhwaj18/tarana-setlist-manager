// Move money: shift money between two places it can live (an account, or a member's pocket).
// A holder is carried as "acct:<id>" for an account, or a member's id.

import { accountIdOf } from './accounts'

export interface HolderColumns { account: string | null; member: string | null }

/** Splits a holder value into the account or member column it belongs in. Null when empty. */
export function holderColumns(value: string): HolderColumns | null {
  if (!value) return null
  const account = accountIdOf(value)
  if (account) return { account, member: null }
  return value.startsWith('acct:') ? null : { account: null, member: value }
}

/** Why a move can't be made as asked, in words for the person, or null when it's fine. */
export function validateMove(from: string, to: string, amount: number): string | null {
  const a = holderColumns(from)
  const b = holderColumns(to)
  if (!a || !b) return 'Choose where the money comes from and where it goes.'
  if (a.account === b.account && a.member === b.member) return 'Choose two different places.'
  if (!a.account && !b.account) return 'A move needs a band account on one side.'
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter an amount above zero.'
  return null
}

const MAX_DESCRIPTION = 300

/** The text saved on each side of a move: "Moved to X" on the way out, "Moved from Y" on the way in, plus any note. */
export function moveDescriptions(fromName: string, toName: string, note?: string): { out: string; in: string } {
  const extra = note?.trim() ? ` · ${note.trim()}` : ''
  return {
    out: `Moved to ${toName}${extra}`.slice(0, MAX_DESCRIPTION),
    in: `Moved from ${fromName}${extra}`.slice(0, MAX_DESCRIPTION),
  }
}
