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
 * Tries designating a single payer with a large enough standing balance as
 * the sole "hub": they pay every recipient in full, up front, out of their
 * own pocket — and every other payer settles up by sending their own full
 * share to the hub in one transfer, whenever's convenient, rather than
 * anyone needing to juggle a fraction of who's owed what. This is simpler
 * than chainedSettlement's surgical, per-recipient topping-up whenever one
 * payer genuinely has money to spare — prefer it first. Only used when that
 * hub's balance can comfortably cover everyone else's share without going
 * negative; returns null when no single payer qualifies.
 */
function tryHubSettlement(owed: Balance[], owers: Balance[], standingBalances: Record<string, number>): Payment[] | null {
  if (owers.length < 2) return null // nothing to consolidate

  const totalOwed = round2(owed.reduce((s, o) => s + o.amount, 0))
  const candidates = [...owers].sort((a, b) => (standingBalances[b.memberId] ?? 0) - (standingBalances[a.memberId] ?? 0))

  for (const hub of candidates) {
    // What everyone else needs to eventually contribute — the amount the
    // hub is fronting until they're reimbursed.
    const gap = round2(totalOwed - hub.amount)
    if (gap <= EPSILON) continue // hub alone already covers everyone; tryExactPartition would've found this
    const buffer = standingBalances[hub.memberId] ?? 0
    if (buffer < gap - EPSILON) continue

    const payments: Payment[] = owed
      .filter(o => o.amount > EPSILON)
      .map(o => ({ from: hub.memberId, to: o.memberId, amount: round2(o.amount) }))
    for (const other of owers) {
      if (other.memberId === hub.memberId || other.amount <= EPSILON) continue
      payments.push({ from: other.memberId, to: hub.memberId, amount: round2(other.amount) })
    }
    return payments
  }
  return null
}

/**
 * Falls back from tryHubSettlement when no single payer's balance can cover
 * everyone — but before accepting a split recipient, tries to avoid it by
 * having the current payer borrow just the exact shortfall from the next
 * payer(s) in line first (an internal transfer), then pay the recipient in
 * full. That's only done when the payer's own already-recorded balance can
 * absorb the shortfall without going negative — a safety margin, since the
 * internal transfer and the outgoing payment may not land on the same day.
 * Only when no payer can safely front the gap does a recipient's payment
 * actually get split — the classic largest-ower-against-largest-owed greedy
 * pass, repeated.
 */
function chainedSettlement(owed: Balance[], owers: Balance[], standingBalances: Record<string, number>): Payment[] {
  const remainingOwed = owed.map(o => ({ ...o }))
  const remainingOwers = owers.map(o => ({ ...o }))
  const availableBuffer: Record<string, number> = { ...standingBalances }
  const payments: Payment[] = []
  let i = 0
  let j = 0

  while (i < remainingOwers.length && j < remainingOwed.length) {
    const ower = remainingOwers[i]
    const recipient = remainingOwed[j]

    if (ower.amount >= recipient.amount - EPSILON) {
      const amount = round2(recipient.amount)
      if (amount > EPSILON) payments.push({ from: ower.memberId, to: recipient.memberId, amount })
      ower.amount = round2(ower.amount - amount)
      j++
      if (ower.amount <= EPSILON) i++
      continue
    }

    const shortfall = round2(recipient.amount - ower.amount)
    const buffer = availableBuffer[ower.memberId] ?? 0
    const laterCapacity = remainingOwers.slice(i + 1).reduce((s, o) => s + o.amount, 0)

    if (buffer >= shortfall - EPSILON && laterCapacity >= shortfall - EPSILON) {
      // Safe to consolidate: pull exactly the shortfall from subsequent
      // payers (in order) so this one payer covers the recipient outright,
      // instead of splitting the recipient's payment across payers.
      let stillNeeded = shortfall
      for (let k = i + 1; k < remainingOwers.length && stillNeeded > EPSILON; k++) {
        const lender = remainingOwers[k]
        if (lender.amount <= EPSILON) continue
        const pulled = round2(Math.min(lender.amount, stillNeeded))
        payments.push({ from: lender.memberId, to: ower.memberId, amount: pulled })
        lender.amount = round2(lender.amount - pulled)
        stillNeeded = round2(stillNeeded - pulled)
      }
      payments.push({ from: ower.memberId, to: recipient.memberId, amount: round2(recipient.amount) })
      availableBuffer[ower.memberId] = round2(buffer - shortfall)
      ower.amount = 0
      i++
      j++
      continue
    }

    // No payer can safely front the gap — split this recipient's payment
    // the plain way and move on to the next payer for the remainder.
    const amount = round2(ower.amount)
    if (amount > EPSILON) payments.push({ from: ower.memberId, to: recipient.memberId, amount })
    recipient.amount = round2(recipient.amount - amount)
    ower.amount = 0
    i++
  }

  return payments
}

/**
 * Given each real member's net position (positive = holding more cash than
 * they're entitled to, so they need to pay out; negative = short, they need
 * to receive), produces the payments that settle everyone. Prefers a clean
 * assignment where every recipient is paid by exactly one payer; when that's
 * not directly possible, tries consolidating through one payer's standing
 * balance — first as a full hub (tryHubSettlement), then as a narrower,
 * surgical top-up for just the one shortfall (chainedSettlement) — before
 * ever splitting a recipient's payment across payers. `standingBalances` —
 * each payer's current overall balance, separate from this batch — gates
 * both; omit it (or pass {}) to skip straight to a direct split whenever a
 * clean assignment isn't possible. Netting positions from multiple shows
 * together before calling this is what makes multi-show batching actually
 * reduce the number of payments.
 */
export function minimizeSettlement(nets: Record<string, number>, standingBalances: Record<string, number> = {}): Payment[] {
  const owers = Object.entries(nets)
    .filter(([, n]) => n > EPSILON)
    .map(([memberId, amount]) => ({ memberId, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount)

  const owed = Object.entries(nets)
    .filter(([, n]) => n < -EPSILON)
    .map(([memberId, amount]) => ({ memberId, amount: round2(-amount) }))
    .sort((a, b) => b.amount - a.amount)

  return (
    tryExactPartition(owed, owers) ??
    tryHubSettlement(owed, owers, standingBalances) ??
    chainedSettlement(owed, owers, standingBalances)
  )
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
