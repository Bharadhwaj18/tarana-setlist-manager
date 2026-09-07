import { describe, it, expect } from 'vitest'
import {
  computeEntitlements,
  computeAbsorbedAmount,
  routeSettlement,
  computeShowSettlement,
  poolShowSettlements,
  type Payment,
} from './settlement'

function sumBy(payments: Payment[], key: 'from' | 'to', id: string) {
  return payments.filter(p => p[key] === id).reduce((s, p) => s + p.amount, 0)
}

describe('computeEntitlements', () => {
  it('splits equally after the band fund cut', () => {
    const { memberShares, bandFundAmount } = computeEntitlements(1000, ['a', 'b', 'c'], 20)
    expect(bandFundAmount).toBe(200)
    expect(memberShares).toEqual({ a: round(800 / 3), b: round(800 / 3), c: round(800 / 3) })
  })

  it('honors overrides and recomputes the remaining equal share', () => {
    const { memberShares, bandFundAmount } = computeEntitlements(1000, ['a', 'b', 'c'], 20, { a: 100 })
    expect(bandFundAmount).toBe(200)
    expect(memberShares.a).toBe(100)
    expect(memberShares.b).toBe(350)
    expect(memberShares.c).toBe(350)
  })
})

describe('computeAbsorbedAmount', () => {
  it('absorbs fully when standing balance covers the front', () => {
    expect(computeAbsorbedAmount(5000, 2000)).toBe(2000)
  })
  it('absorbs nothing when standing balance is already zero/negative', () => {
    expect(computeAbsorbedAmount(0, 2000)).toBe(0)
    expect(computeAbsorbedAmount(-500, 2000)).toBe(0)
  })
  it('partially absorbs up to the standing balance', () => {
    expect(computeAbsorbedAmount(1200, 2000)).toBe(1200)
  })
})

describe('routeSettlement — self-pay', () => {
  it('a member with enough of their own capacity pays themselves, one payment', () => {
    const payments = routeSettlement({ a: 500 }, { a: 800 })
    expect(payments).toEqual([{ from: 'a', to: 'a', amount: 500 }])
  })

  it('falls back to pre-existing fund balance when capacity is insufficient', () => {
    const payments = routeSettlement({ a: 500 }, { a: 200 }, { a: 400 })
    expect(payments).toEqual([{ from: 'a', to: 'a', amount: 500 }])
  })

  it('leaves a shortfall unassigned when neither capacity nor fund cover it — routed to nobody, since there is nobody else to pay it', () => {
    const payments = routeSettlement({ a: 500 }, { a: 100 }, { a: 50 })
    expect(payments).toEqual([{ from: 'a', to: 'a', amount: 150 }])
  })
})

describe('routeSettlement — the Babai Tiffins HSR example (canonical)', () => {
  // Raga collected all the cash for the show. Cuts: B Rao 11827, Raga
  // 11827, You (Bharadwaj) 11827; Band Fund 8870 (already deducted from
  // Raga's capacity by computeShowSettlement, not part of amountOwed).
  // Confirmed by Shreyas: exactly 3 debit transactions, all from Raga, none
  // of them a credit to anyone.
  it('produces exactly 3 debits, all from Raga, none of them a credit', () => {
    const amountOwed = { bRao: 11827, raga: 11827, you: 11827 }
    const capacity = { raga: 35481 } // her spare cash after the Band Fund cut is set aside
    const payments = routeSettlement(amountOwed, capacity)

    expect(payments).toHaveLength(3)
    expect(payments.every(p => p.from === 'raga')).toBe(true)
    expect(payments.some(p => p.to === 'raga')).toBe(true) // her own cut, self-paid
    expect(sumBy(payments, 'to', 'bRao')).toBe(11827)
    expect(sumBy(payments, 'to', 'raga')).toBe(11827)
    expect(sumBy(payments, 'to', 'you')).toBe(11827)
    expect(payments.reduce((s, p) => s + p.amount, 0)).toBe(35481)
  })

  it('reconciles end to end via computeShowSettlement/poolShowSettlements — Band Fund left is exactly the plain band fund cut, no separate "extra" calculation needed', () => {
    const net = 64350
    const bandPct = 20
    const involved = ['bRao', 'raga', 'you']
    const { memberShares, bandFundAmount } = computeEntitlements(net, involved, bandPct)

    // Raga collected all the cash; nobody fronted anything for this show.
    const cashPositions = { raga: net }
    const settlement = computeShowSettlement({
      involvedMemberIds: involved,
      entitlements: memberShares,
      bandFundAmount,
      bandFundHolderId: 'raga',
      cashPositions,
      reimbursements: {},
    })
    const pooled = poolShowSettlements([settlement])
    const payments = routeSettlement(pooled.amountOwed, pooled.capacity)

    expect(payments.every(p => p.from === 'raga')).toBe(true)
    const paidOut = payments.reduce((s, p) => s + p.amount, 0)
    const ragaLeftHolding = round(net - paidOut)
    // memberPool (net - bandFundAmount) is fully paid out as the 3 cuts, so
    // what's left in Raga's hands is exactly the band fund cut — it falls
    // out naturally, no separate "extra Band Fund" tracking needed.
    expect(ragaLeftHolding).toBe(bandFundAmount)
  })

  it('a fully-absorbed front simply never becomes a payment — nobody pays it, so it never dents the band fund', () => {
    // You fronts 20000 for the show but their own standing balance is
    // healthy enough to absorb all of it, so reimbursements is empty —
    // exactly the same amountOwed for You as if they'd fronted nothing.
    const involved = ['bRao', 'raga', 'you']
    const entitlements = { bRao: 11827, raga: 11827, you: 11827 }
    const withFront = computeShowSettlement({
      involvedMemberIds: involved,
      entitlements,
      bandFundAmount: 8870,
      bandFundHolderId: 'raga',
      cashPositions: { raga: 35481, you: -20000 },
      reimbursements: {},
    })
    const withoutFront = computeShowSettlement({
      involvedMemberIds: involved,
      entitlements,
      bandFundAmount: 8870,
      bandFundHolderId: 'raga',
      cashPositions: { raga: 35481 },
      reimbursements: {},
    })
    // You's amountOwed (their cut alone) is identical either way — the
    // absorbed front changes nothing about what anyone owes or pays.
    expect(withFront.amountOwed.you).toBe(withoutFront.amountOwed.you)
    expect(withFront.capacity.raga).toBe(withoutFront.capacity.raga)
  })
})

describe('routeSettlement — direct routing, no payer-to-payer transactions', () => {
  it('two payers each pay their own share directly to the same recipient — 2 separate debits', () => {
    const payments = routeSettlement({ recipient: 1000 }, { payerA: 600, payerB: 400 })
    expect(payments).toHaveLength(2)
    expect(sumBy(payments, 'to', 'recipient')).toBe(1000)
    expect(payments.some(p => p.from === 'payerA' && p.to === 'recipient' && p.amount === 600)).toBe(true)
    expect(payments.some(p => p.from === 'payerB' && p.to === 'recipient' && p.amount === 400)).toBe(true)
  })

  it('a hub with a bigger fund balance absorbs another payer\'s share — the absorbed payer makes NO payment, and the hub is never reimbursed for it', () => {
    // No clean 1-payer-per-recipient split exists (X=500 can't be covered
    // by either payer alone), so it falls to the hub: Harsh's 1000 fund
    // buffer fully absorbs Raga's 400 capacity, giving Harsh 700 combined
    // capacity to pay both recipients directly. Confirmed: "Harsh doesn't
    // get reimbursed by raga. Harsh's balance absorbs it."
    const amountOwed = { recipientX: 500, recipientY: 200 }
    const capacity = { harsh: 300, raga: 400 }
    const fundBalances = { harsh: 1000, raga: 50 }

    const payments = routeSettlement(amountOwed, capacity, fundBalances)

    // Raga makes no payment at all — her capacity was absorbed into Harsh's hub.
    expect(payments.some(p => p.from === 'raga')).toBe(false)
    // Every payment comes from Harsh, straight to the actual recipients.
    expect(payments.every(p => p.from === 'harsh')).toBe(true)
    expect(sumBy(payments, 'to', 'recipientX')).toBe(500)
    expect(sumBy(payments, 'to', 'recipientY')).toBe(200)
    // No payment from Raga to Harsh, ever — absorption is not a reimbursement.
    expect(payments.some(p => p.to === 'harsh')).toBe(false)
  })

  it('when the hub can only partially absorb, the remainder is still paid directly to the recipient, never routed through the hub', () => {
    const amountOwed = { recipientX: 350, recipientY: 450 }
    const capacity = { harsh: 300, raga: 500 }
    const fundBalances = { harsh: 200, raga: 50 } // harsh can only absorb 200 of raga's 500

    const payments = routeSettlement(amountOwed, capacity, fundBalances)

    // Raga still pays the unabsorbed portion directly to a recipient — not to Harsh.
    const ragaPayments = payments.filter(p => p.from === 'raga')
    expect(ragaPayments.every(p => p.to !== 'harsh')).toBe(true)
    expect(ragaPayments.reduce((s, p) => s + p.amount, 0)).toBe(300)
    // Totals still reconcile.
    expect(sumBy(payments, 'to', 'recipientX')).toBe(350)
    expect(sumBy(payments, 'to', 'recipientY')).toBe(450)
  })
})

describe('routeSettlement — edge cases', () => {
  it('returns no payments when nobody owes anything', () => {
    expect(routeSettlement({}, {})).toEqual([])
  })

  it('ignores negligible amounts under the epsilon', () => {
    const payments = routeSettlement({ a: 0.001 }, { a: 10 })
    expect(payments).toEqual([])
  })

  it('falls back to a greedy split when neither exact partition nor a hub works and there are more recipients than payers can cover cleanly', () => {
    const amountOwed = { x: 300, y: 300, z: 300 }
    const capacity = { p: 450, q: 450 }
    const payments = routeSettlement(amountOwed, capacity)
    expect(sumBy(payments, 'to', 'x') + sumBy(payments, 'to', 'y') + sumBy(payments, 'to', 'z')).toBe(900)
    expect(sumBy(payments, 'from', 'p') + sumBy(payments, 'from', 'q')).toBe(900)
  })
})

describe('computeShowSettlement + poolShowSettlements', () => {
  it('deducts the band fund cut only from the holder\'s capacity', () => {
    const result = computeShowSettlement({
      involvedMemberIds: ['a', 'b'],
      entitlements: { a: 400, b: 400 },
      bandFundAmount: 200,
      bandFundHolderId: 'a',
      cashPositions: { a: 1000 },
    })
    expect(result.capacity.a).toBe(800) // 1000 collected minus the 200 band fund cut
    expect(result.capacity.b).toBe(0) // b handled no cash for this show
    expect(result.amountOwed).toEqual({ a: 400, b: 400 })
  })

  it('folds reimbursement into amountOwed, on top of the entitlement', () => {
    const result = computeShowSettlement({
      involvedMemberIds: ['a', 'b'],
      entitlements: { a: 400, b: 400 },
      bandFundAmount: 200,
      bandFundHolderId: 'a',
      cashPositions: { a: 1000, b: -300 },
      reimbursements: { b: 150 }, // b fronted 300, but only 150 wasn't absorbed by standing balance
    })
    expect(result.capacity.b).toBe(-300)
    expect(result.amountOwed.b).toBe(550)
  })

  it('pools capacity and amountOwed across multiple shows', () => {
    const s1 = computeShowSettlement({
      involvedMemberIds: ['a', 'b'],
      entitlements: { a: 100, b: 100 },
      bandFundAmount: 50,
      bandFundHolderId: 'a',
      cashPositions: { a: 250 },
    })
    const s2 = computeShowSettlement({
      involvedMemberIds: ['a', 'b'],
      entitlements: { a: 100, b: 100 },
      bandFundAmount: 50,
      bandFundHolderId: 'b',
      cashPositions: { b: 250 },
    })
    const pooled = poolShowSettlements([s1, s2])
    expect(pooled.amountOwed).toEqual({ a: 200, b: 200 })
    expect(pooled.capacity.a).toBe(200) // 250 - 50 band fund from show 1
    expect(pooled.capacity.b).toBe(200) // 250 - 50 band fund from show 2
  })
})

function round(n: number) {
  return Math.round(n * 100) / 100
}
