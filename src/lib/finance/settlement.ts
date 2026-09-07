import { round2, computeAutoReimbursement } from './reimbursement'

export interface EntitlementResult {
  /** memberId -> their share of this show's net */
  memberShares: Record<string, number>
  bandFundAmount: number
}

/**
 * Splits one show's net amount into member shares + the Band Fund cut.
 * Equal by default among the involved members; any member id present in
 * `overrides` gets that exact amount instead, and the equal share is
 * recomputed over whoever's left so the pool still balances.
 */
export function computeEntitlements(
  netAmount: number,
  involvedMemberIds: string[],
  bandFundPct: number,
  overrides: Record<string, number> = {}
): EntitlementResult {
  const bandFundAmount = round2((netAmount * bandFundPct) / 100)
  const memberPool = round2(netAmount - bandFundAmount)

  const overriddenIds = involvedMemberIds.filter(id => overrides[id] !== undefined)
  const overriddenTotal = overriddenIds.reduce((sum, id) => sum + overrides[id], 0)
  const remainingIds = involvedMemberIds.filter(id => overrides[id] === undefined)
  const remainingPool = round2(memberPool - overriddenTotal)
  const equalShare = remainingIds.length > 0 ? round2(remainingPool / remainingIds.length) : 0

  const memberShares: Record<string, number> = {}
  for (const id of involvedMemberIds) {
    memberShares[id] = overrides[id] !== undefined ? overrides[id] : equalShare
  }

  return { memberShares, bandFundAmount }
}

/**
 * How much of a fronted show expense a member's own standing balance (from
 * before this show) already covers. This portion doesn't need to be paid
 * back in real cash — it's already reflected in what they're holding, and
 * the reimbursement floor is: don't ask anyone to pay back money that
 * would've just sat in a positive balance anyway. See `computeShowSettlement`
 * for how the remaining real shortfall (if any) becomes part of what they're
 * owed.
 */
export function computeAbsorbedAmount(standingBalanceBeforeShow: number, amountFronted: number): number {
  const reimbursed = computeAutoReimbursement(standingBalanceBeforeShow, amountFronted)
  return round2(Math.max(0, amountFronted - reimbursed))
}

export interface Payment {
  from: string
  to: string
  amount: number
}

const EPSILON = 0.01

interface Balance { memberId: string; amount: number }

/**
 * Tries to assign every recipient (owed) to exactly one payer (ower) —
 * never splitting a single recipient's payment across multiple payers —
 * by exhaustively searching for a way to partition the owed amounts into
 * groups that each exactly consume one ower's capacity. A payer can still
 * cover several different recipients; only the receiving side is
 * guaranteed single-sourced. Exhaustive, but the list is at most a
 * handful of band members, so this is instant in practice. Returns null
 * if no such clean partition exists at all.
 */
function tryExactPartition(owed: Balance[], owers: Balance[]): Payment[] | null {
  const capacities = owers.map(o => o.amount)
  const assignedTo: number[] = new Array(owed.length).fill(-1)

  function backtrack(index: number): boolean {
    if (index === owed.length) {
      return capacities.every(c => Math.abs(c) < EPSILON)
    }
    for (let i = 0; i < capacities.length; i++) {
      if (capacities[i] >= owed[index].amount - EPSILON) {
        capacities[i] = round2(capacities[i] - owed[index].amount)
        assignedTo[index] = i
        if (backtrack(index + 1)) return true
        capacities[i] = round2(capacities[i] + owed[index].amount)
        assignedTo[index] = -1
      }
    }
    return false
  }

  if (!backtrack(0)) return null

  return owed
    .map((o, idx) => ({ from: owers[assignedTo[idx]].memberId, to: o.memberId, amount: round2(o.amount) }))
    .filter(p => p.amount > EPSILON)
}

/**
 * Falls back from tryExactPartition when a clean assignment isn't possible —
 * the classic largest-ower-against-largest-owed greedy pass, repeated. Still
 * minimizes the total number of payments, but may split one recipient's
 * payment across more than one payer where amounts don't divide cleanly.
 */
function greedySettlement(owed: Balance[], owers: Balance[]): Payment[] {
  const remainingOwed = owed.map(o => ({ ...o }))
  const remainingOwers = owers.map(o => ({ ...o }))
  const payments: Payment[] = []
  let i = 0
  let j = 0

  while (i < remainingOwers.length && j < remainingOwed.length) {
    const amount = round2(Math.min(remainingOwers[i].amount, remainingOwed[j].amount))
    if (amount > EPSILON) payments.push({ from: remainingOwers[i].memberId, to: remainingOwed[j].memberId, amount })
    remainingOwers[i].amount = round2(remainingOwers[i].amount - amount)
    remainingOwed[j].amount = round2(remainingOwed[j].amount - amount)
    if (remainingOwers[i].amount <= EPSILON) i++
    if (remainingOwed[j].amount <= EPSILON) j++
  }

  return payments
}

/**
 * Consolidates payments through whoever holds the most pre-existing Band
 * Fund, instead of splitting a recipient's payment across payers. That hub
 * pays recipients directly using their own capacity plus whatever they can
 * safely absorb (via their own fund buffer) from other payers' capacity —
 * an absorbed portion never becomes a real payment for anyone: the other
 * payer's share simply isn't assigned to them, and the hub's own direct
 * payment to the recipient already covers it, permanently, with nothing
 * paid back to the hub for it. Any of another payer's capacity the hub's
 * buffer *can't* absorb still gets paid — directly to whichever recipient
 * needs it, never routed through the hub. Returns null when there's nobody
 * to consolidate through (fewer than two payers).
 */
function tryHubSettlement(owed: Balance[], owers: Balance[], fundBalances: Record<string, number>): Payment[] | null {
  if (owers.length < 2) return null

  const hub = owers[0] // owers is already sorted by fund balance descending — the biggest fund holder
  let hubCapacity = hub.amount
  let hubBuffer = fundBalances[hub.memberId] ?? 0

  const combinedPayers: Balance[] = []
  for (const other of owers.slice(1)) {
    const absorbed = round2(Math.min(hubBuffer, other.amount))
    hubBuffer = round2(hubBuffer - absorbed)
    hubCapacity = round2(hubCapacity + absorbed)
    const stillReal = round2(other.amount - absorbed)
    if (stillReal > EPSILON) combinedPayers.push({ memberId: other.memberId, amount: stillReal })
  }
  combinedPayers.unshift({ memberId: hub.memberId, amount: hubCapacity })

  return tryExactPartition(owed, combinedPayers) ?? greedySettlement(owed, combinedPayers)
}

/**
 * Routes every involved member's amountOwed to one or more payers, as a
 * direct debit list — payer -> recipient, amount. Every payment (including
 * someone covering their own amount, `from === to`) becomes exactly one
 * ledger debit on the payer; nobody is ever credited, since money paid out
 * to a recipient becomes personal the moment it's paid and this app only
 * tracks Band Fund. A member's own spare capacity from this batch's shows,
 * then their pre-existing Band Fund, both count toward covering their own
 * amountOwed first (self-pay); whatever's left routes to other payers with
 * spare capacity — preferring a clean assignment where each recipient is
 * paid by exactly one payer, then consolidating through whoever holds the
 * most pre-existing Band Fund (tryHubSettlement), and only splitting a
 * recipient's payment across payers as a last resort.
 */
export function routeSettlement(
  amountOwed: Record<string, number>,
  capacity: Record<string, number>,
  fundBalances: Record<string, number> = {}
): Payment[] {
  const remainingOwed: Record<string, number> = { ...amountOwed }
  const remainingCapacity: Record<string, number> = { ...capacity }
  const remainingFund: Record<string, number> = { ...fundBalances }
  const payments: Payment[] = []

  // Self-pay: a member's own spare capacity from this batch, then their own
  // pre-existing Band Fund, cover as much of their own amountOwed as
  // possible before anyone else needs to be involved at all.
  for (const id of Object.keys(remainingOwed)) {
    const owed = remainingOwed[id] ?? 0
    if (owed <= EPSILON) continue

    const ownCapacity = Math.max(0, remainingCapacity[id] ?? 0)
    const fromCapacity = round2(Math.min(ownCapacity, owed))
    remainingCapacity[id] = round2((remainingCapacity[id] ?? 0) - fromCapacity)

    const stillOwed = round2(owed - fromCapacity)
    const fromFund = stillOwed > EPSILON ? round2(Math.min(remainingFund[id] ?? 0, stillOwed)) : 0
    if (fromFund > EPSILON) remainingFund[id] = round2((remainingFund[id] ?? 0) - fromFund)

    const selfPaid = round2(fromCapacity + fromFund)
    if (selfPaid > EPSILON) {
      payments.push({ from: id, to: id, amount: selfPaid })
      remainingOwed[id] = round2(owed - selfPaid)
    }
  }

  const payers = Object.entries(remainingCapacity)
    .filter(([, n]) => n > EPSILON)
    .map(([memberId, amount]) => ({ memberId, amount: round2(amount) }))
    .sort((a, b) => (remainingFund[b.memberId] ?? 0) - (remainingFund[a.memberId] ?? 0))

  const recipients = Object.entries(remainingOwed)
    .filter(([, n]) => n > EPSILON)
    .map(([memberId, amount]) => ({ memberId, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount)

  if (payers.length === 0 || recipients.length === 0) return payments

  const exact = tryExactPartition(recipients, payers)
  if (exact) return [...payments, ...exact]

  const hub = tryHubSettlement(recipients, payers, remainingFund)
  if (hub) return [...payments, ...hub]

  return [...payments, ...greedySettlement(recipients, payers)]
}

export interface ShowSettlementInput {
  involvedMemberIds: string[]
  /** memberId -> their cut of this show */
  entitlements: Record<string, number>
  /** the plain Band Fund % cut for this show — not inflated by any absorbed savings, those just fall out naturally as leftover capacity */
  bandFundAmount: number
  /** who keeps the Band Fund's cut for this show — typically whoever collected it */
  bandFundHolderId: string
  /** raw cash each involved member handled for this show (credits positive, expenses negative) */
  cashPositions: Record<string, number>
  /** memberId -> real cash still owed back for a fronted expense, after their own standing balance covers what it can (from computeAbsorbedAmount) */
  reimbursements?: Record<string, number>
}

export interface ShowSettlementResult {
  /** memberId -> spare cash this show leaves them holding, beyond their own Band Fund obligation if they're the holder. Can be negative (e.g. they fronted an expense). */
  capacity: Record<string, number>
  /** memberId -> what they're owed from this show — their cut plus any real reimbursement for fronting. */
  amountOwed: Record<string, number>
}

/**
 * One show's contribution to the batch: how much spare cash each involved
 * member is left holding (capacity), and how much each is owed (their cut,
 * plus a real reimbursement if they fronted something that wasn't fully
 * absorbed by their own standing balance). Pool these across every show in
 * a batch (poolShowSettlements) before calling routeSettlement.
 */
export function computeShowSettlement(input: ShowSettlementInput): ShowSettlementResult {
  const capacity: Record<string, number> = {}
  const amountOwed: Record<string, number> = {}
  for (const id of input.involvedMemberIds) {
    let cap = round2(input.cashPositions[id] ?? 0)
    if (id === input.bandFundHolderId) cap = round2(cap - input.bandFundAmount)
    capacity[id] = cap
    amountOwed[id] = round2((input.entitlements[id] ?? 0) + (input.reimbursements?.[id] ?? 0))
  }
  return { capacity, amountOwed }
}

/** Sums per-show capacity and amountOwed from multiple shows into one pooled settlement input. */
export function poolShowSettlements(results: ShowSettlementResult[]): ShowSettlementResult {
  const capacity: Record<string, number> = {}
  const amountOwed: Record<string, number> = {}
  for (const r of results) {
    for (const [id, v] of Object.entries(r.capacity)) capacity[id] = round2((capacity[id] ?? 0) + v)
    for (const [id, v] of Object.entries(r.amountOwed)) amountOwed[id] = round2((amountOwed[id] ?? 0) + v)
  }
  return { capacity, amountOwed }
}
