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
 * before this show) already covers. This portion is *not* reimbursed
 * through the show settlement below — the settlement always pays back the
 * full amount fronted, keeping its books balanced on their own — instead
 * it's recorded as a separate correction transaction (debiting the member
 * this amount, untagged to the show) alongside the split, since it isn't
 * really the show's cost to bear: the member is just cashing in value they
 * were already recognized as owed from something earlier. Net effect on
 * their final balance is identical either way; keeping it a separate,
 * clearly-labeled entry is what stays auditable and doesn't require
 * reaching into anyone else's settlement math to make the numbers work.
 */
export function computeAbsorbedAmount(standingBalanceBeforeShow: number, amountFronted: number): number {
  const reimbursed = computeAutoReimbursement(standingBalanceBeforeShow, amountFronted)
  return round2(Math.max(0, amountFronted - reimbursed))
}

/**
 * The ledger transaction amount that brings a member's already-recorded cash
 * position (from this show's own transactions) up to their true entitlement.
 * Crediting the flat entitlement on its own would double-count whatever cash
 * they already handled: a member who fronted an expense (negative cash
 * position) needs the difference added back, and one who collected surplus
 * cash (positive cash position) needs the excess taken back. Doesn't apply
 * the reimbursement floor — see computeAbsorbedAmount for that separate,
 * standing-balance-only correction, recorded as its own transaction.
 */
export function computeSettlementLedgerDelta(entitlement: number, cashPosition: number): number {
  return round2(entitlement - cashPosition)
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

export interface SettlementResult {
  payments: Payment[]
  /**
   * memberId -> amount they fronted on another payer's behalf, out of their
   * own tagged Band Fund balance, that genuinely doesn't need paying back —
   * needs a ledger deduction (separate from any specific show) so their
   * recorded balance matches what they actually still have, since nothing
   * else accounts for that money having left their pocket.
   */
  consolidationAbsorptions: Record<string, number>
  /**
   * memberId -> amount they were owed that they covered out of their own
   * tagged Band Fund balance instead of receiving real cash — the fund they
   * already hold just gets relabeled as this payout. Needs a ledger
   * deduction (see splitShows) so their total balance doesn't inflate.
   */
  selfSatisfactions: Record<string, number>
  /**
   * memberId -> net position after self-satisfaction but before any payment
   * routing — positive means they still need to pay this much for real,
   * negative means they still need to receive this much for real. This is
   * "how much does each person actually owe/get" independent of who ends up
   * paying whom — useful for a manual, unrouted view of the settlement.
   */
  remainingNets: Record<string, number>
}

/**
 * Consolidates every recipient onto a single payer — whoever currently
 * holds the most tagged Band Fund, since this whole section exists to track
 * that fund and routing through its biggest holder is the most natural fit
 * — instead of splitting a recipient's payment across payers. That hub pays
 * every recipient in full, up front; every other payer then only owes the
 * hub whatever the hub's own fund balance can't already absorb on their
 * behalf, following the same reimbursement-floor rule as fronting a show
 * expense or a recipient self-satisfying: don't ask anyone to pay back
 * money that would've just sat in a fund balance anyway. Whatever the hub
 * does absorb comes back as `consolidationAbsorptions`, for a ledger
 * deduction. Returns null only when there's nobody to consolidate through
 * (fewer than two payers).
 */
function tryHubSettlement(owed: Balance[], owers: Balance[], fundBalances: Record<string, number>): { payments: Payment[]; consolidationAbsorptions: Record<string, number> } | null {
  if (owers.length < 2) return null

  const totalOwed = round2(owed.reduce((s, o) => s + o.amount, 0))
  const hub = owers[0] // owers is already sorted by fund balance descending — the biggest fund holder
  const gap = round2(totalOwed - hub.amount)

  const payments: Payment[] = []
  const consolidationAbsorptions: Record<string, number> = {}

  if (gap > EPSILON) {
    let hubBuffer = fundBalances[hub.memberId] ?? 0
    for (const other of owers.slice(1)) {
      if (other.amount <= EPSILON) continue
      const absorbed = round2(Math.min(hubBuffer, other.amount))
      const realPayment = round2(other.amount - absorbed)
      if (absorbed > EPSILON) {
        consolidationAbsorptions[hub.memberId] = round2((consolidationAbsorptions[hub.memberId] ?? 0) + absorbed)
        hubBuffer = round2(hubBuffer - absorbed)
      }
      if (realPayment > EPSILON) payments.push({ from: other.memberId, to: hub.memberId, amount: realPayment })
    }
  }

  for (const recipient of owed) {
    if (recipient.amount > EPSILON) payments.push({ from: hub.memberId, to: recipient.memberId, amount: round2(recipient.amount) })
  }

  return { payments, consolidationAbsorptions }
}

/**
 * Given each real member's net position (positive = holding more cash than
 * they're entitled to, so they need to pay out; negative = short, they need
 * to receive), produces the payments that settle everyone. First lets each
 * recipient self-satisfy out of their own tagged Band Fund balance — no one
 * needs fresh cash for a share they're already sitting on. For what's left,
 * prefers a clean assignment where every recipient is paid by exactly one
 * payer; when that's not directly possible, consolidates through whoever
 * holds the most Band Fund (tryHubSettlement) before ever splitting a
 * recipient's payment across payers. `fundBalances` — each member's current
 * tagged Band Fund balance (`category: 'fund'` transactions only, not their
 * whole balance) — drives both of those; omit it (or pass {}) to skip
 * straight to a direct split whenever a clean assignment isn't possible.
 * Netting positions from multiple shows together before calling this is
 * what makes multi-show batching actually reduce the number of payments.
 */
export function minimizeSettlement(nets: Record<string, number>, fundBalances: Record<string, number> = {}): SettlementResult {
  // Let each recipient cover as much of their own share as their tagged
  // Band Fund allows before anyone else needs to pay them anything.
  const selfSatisfactions: Record<string, number> = {}
  const adjustedNets: Record<string, number> = { ...nets }
  const availableFund: Record<string, number> = { ...fundBalances }

  for (const [id, net] of Object.entries(nets)) {
    if (net >= -EPSILON) continue // not owed anything
    const owed = -net
    const fund = availableFund[id] ?? 0
    const satisfied = round2(Math.min(fund, owed))
    if (satisfied > EPSILON) {
      selfSatisfactions[id] = satisfied
      adjustedNets[id] = round2(net + satisfied)
      availableFund[id] = round2(fund - satisfied)
    }
  }

  const owers = Object.entries(adjustedNets)
    .filter(([, n]) => n > EPSILON)
    .map(([memberId, amount]) => ({ memberId, amount: round2(amount) }))
    .sort((a, b) => (availableFund[b.memberId] ?? 0) - (availableFund[a.memberId] ?? 0))

  const owed = Object.entries(adjustedNets)
    .filter(([, n]) => n < -EPSILON)
    .map(([memberId, amount]) => ({ memberId, amount: round2(-amount) }))
    .sort((a, b) => b.amount - a.amount)

  const exact = tryExactPartition(owed, owers)
  if (exact) return { payments: exact, consolidationAbsorptions: {}, selfSatisfactions, remainingNets: adjustedNets }

  const hub = tryHubSettlement(owed, owers, availableFund)
  if (hub) return { ...hub, selfSatisfactions, remainingNets: adjustedNets }

  return { payments: greedySettlement(owed, owers), consolidationAbsorptions: {}, selfSatisfactions, remainingNets: adjustedNets }
}

export interface ShowSettlementInput {
  involvedMemberIds: string[]
  entitlements: Record<string, number>
  bandFundAmount: number
  /** who keeps the Band Fund's cut for this show — typically whoever collected it */
  bandFundHolderId: string
  /** raw cash each involved member handled for this show (credits positive, expenses negative) */
  cashPositions: Record<string, number>
  /**
   * memberId -> amount of their fronted expense already covered by their own
   * standing balance (from computeAbsorbedAmount) — money they don't need
   * paid back in cash because their balance never actually went negative for
   * it. Reduces what the real settlement below asks anyone to hand them.
   * This is entirely separate from — and doesn't affect — the ledger
   * bookkeeping in computeSettlementLedgerDelta, which reconciles each
   * member's recorded balance to their entitlement on its own terms
   * regardless of how the real cash is routed.
   */
  absorptions?: Record<string, number>
}

/**
 * Net settlement position for one show, per involved member — positive
 * means they need to pay out, negative means they're owed. Balances to zero
 * before absorption (sum of cash positions == netAmount by construction);
 * an absorption reduces what its member is owed without a matching increase
 * elsewhere, since that portion is real cash they already have on hand and
 * genuinely doesn't need to move — the payer(s) simply pay out that much
 * less. Feed the sums of these across every show in a batch into
 * minimizeSettlement to get pooled, minimized payment instructions.
 */
export function computeShowSettlementNets(input: ShowSettlementInput): Record<string, number> {
  const nets: Record<string, number> = {}
  for (const id of input.involvedMemberIds) {
    let net = round2((input.cashPositions[id] ?? 0) - (input.entitlements[id] ?? 0))
    if (id === input.bandFundHolderId) net = round2(net - input.bandFundAmount)
    net = round2(net + (input.absorptions?.[id] ?? 0))
    nets[id] = net
  }
  return nets
}

/** Sums per-member nets from multiple shows into one pooled settlement input. */
export function poolSettlementNets(perShowNets: Record<string, number>[]): Record<string, number> {
  const pooled: Record<string, number> = {}
  for (const showNets of perShowNets) {
    for (const [id, net] of Object.entries(showNets)) {
      pooled[id] = round2((pooled[id] ?? 0) + net)
    }
  }
  return pooled
}
