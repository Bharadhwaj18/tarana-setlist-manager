import { describe, it, expect } from 'vitest'
import {
  computeEntitlements,
  computeAbsorbedAmount,
  computeSettlementLedgerDelta,
  minimizeSettlement,
  computeShowSettlementNets,
  poolSettlementNets,
} from './settlement'

describe('computeEntitlements', () => {
  it('splits 80/20 equally among involved members — the BMC worked example', () => {
    const result = computeEntitlements(148_000, ['aditya', 'kavya', 'rohan', 'meera', 'vikram'], 20)
    expect(result.bandFundAmount).toBe(29_600)
    expect(result.memberShares).toEqual({
      aditya: 23_680, kavya: 23_680, rohan: 23_680, meera: 23_680, vikram: 23_680,
    })
  })

  it('honors an override and recomputes the equal share over the rest', () => {
    const result = computeEntitlements(100_000, ['a', 'b', 'c'], 0, { a: 50_000 })
    expect(result.memberShares.a).toBe(50_000)
    expect(result.memberShares.b).toBe(25_000)
    expect(result.memberShares.c).toBe(25_000)
  })
})

describe('computeAbsorbedAmount', () => {
  it('absorbs nothing when standing balance is zero — full amount stays reimbursable', () => {
    expect(computeAbsorbedAmount(0, 12_000)).toBe(0)
  })

  it('absorbs only what the standing balance can cover — the proposal\'s worked example', () => {
    expect(computeAbsorbedAmount(8_000, 20_000)).toBe(8_000)
  })

  it('absorbs the full amount when the standing balance more than covers it', () => {
    expect(computeAbsorbedAmount(25_000, 20_000)).toBe(20_000)
  })

  it('absorbs nothing when the standing balance is already negative', () => {
    expect(computeAbsorbedAmount(-5_000, 1_000)).toBe(0)
  })
})

describe('computeSettlementLedgerDelta', () => {
  it('credits the full entitlement when the member handled no cash at all', () => {
    expect(computeSettlementLedgerDelta(23_680, 0)).toBe(23_680)
  })

  it('reconciles up to entitlement for someone who fronted an expense — the raw expense txn is already recorded, this just tops it up', () => {
    // Rohan fronted 12,000 (cashPosition -12,000) and is entitled to 23,680.
    // His already-recorded -12,000 plus this delta must land him at exactly
    // his entitlement.
    const delta = computeSettlementLedgerDelta(23_680, -12_000)
    expect(delta).toBe(35_680)
    expect(-12_000 + delta).toBe(23_680)
  })

  it('claws back the surplus for someone who collected more cash than their share — the BMC band fund holder', () => {
    // Aditya collected 170,000 and is entitled to 23,680 + kept a 29,600
    // Band Fund cut separately. This delta plus that separate fund credit,
    // on top of his already-recorded +170,000, must land him at 53,280.
    const delta = computeSettlementLedgerDelta(23_680, 170_000)
    expect(delta).toBe(-146_320)
    expect(170_000 + delta + 29_600).toBe(53_280)
  })
})

describe('minimizeSettlement', () => {
  it('produces one payment for a single ower / single owed pair', () => {
    const { payments } = minimizeSettlement({ a: 100, b: -100 })
    expect(payments).toEqual([{ from: 'a', to: 'b', amount: 100 }])
  })

  it('reproduces the exact BMC single-show settlement from the proposal', () => {
    const nets = { aditya: 116_720, kavya: -33_680, rohan: -35_680, meera: -23_680, vikram: -23_680 }
    const { payments } = minimizeSettlement(nets)
    expect(payments).toEqual([
      { from: 'aditya', to: 'rohan', amount: 35_680 },
      { from: 'aditya', to: 'kavya', amount: 33_680 },
      { from: 'aditya', to: 'meera', amount: 23_680 },
      { from: 'aditya', to: 'vikram', amount: 23_680 },
    ])
  })

  it('with two or more payers, every recipient is paid by exactly one person — the biggest payer consolidates, others just settle up with them', () => {
    // Kavya's 9,520 doesn't match any single recipient, so a direct
    // partition is impossible — but with Aditya (the bigger payer) as the
    // consolidator, Sanya still gets paid in one shot instead of split.
    const nets = { aditya: 95_120, kavya: 9_520, rohan: -35_680, meera: -23_680, vikram: -23_680, sanya: -21_600 }
    const { payments, consolidationAbsorptions } = minimizeSettlement(nets)
    for (const recipient of ['rohan', 'meera', 'vikram', 'sanya']) {
      const paymentsToThem = payments.filter(p => p.to === recipient)
      expect(paymentsToThem).toHaveLength(1)
      expect(paymentsToThem[0].from).toBe('aditya')
    }
    // No standing balance was given, so Kavya pays her full share for real —
    // nothing gets silently absorbed.
    expect(payments.find(p => p.from === 'kavya' && p.to === 'aditya')?.amount).toBe(9_520)
    expect(consolidationAbsorptions).toEqual({})
  })

  it('never splits one recipient across multiple payers when a clean assignment exists', () => {
    // z (50) can only fit a's capacity (50), forcing z -> a. That leaves b's
    // capacity (30) to cover x (10) and y (20) exactly — a valid assignment
    // with zero recipients split, even though a naive largest-vs-largest
    // greedy pass would need to verify this same outcome by coincidence.
    const nets = { a: 50, b: 30, x: -10, y: -20, z: -50 }
    const { payments } = minimizeSettlement(nets)

    // Every recipient appears as `to` in exactly one payment.
    for (const recipient of ['x', 'y', 'z']) {
      const paymentsToThem = payments.filter(p => p.to === recipient)
      expect(paymentsToThem).toHaveLength(1)
    }
    expect(payments.find(p => p.to === 'z')?.from).toBe('a')

    // Fully settles: nothing left over.
    const net: Record<string, number> = { a: 0, b: 0, x: 0, y: 0, z: 0 }
    for (const p of payments) { net[p.from] -= p.amount; net[p.to] += p.amount }
    expect(net.a).toBeCloseTo(-50)
    expect(net.b).toBeCloseTo(-30)
    expect(net.x).toBeCloseTo(10)
    expect(net.y).toBeCloseTo(20)
    expect(net.z).toBeCloseTo(50)
  })

  it('nets to nothing when everyone is already settled', () => {
    const { payments } = minimizeSettlement({ a: 0, b: 0 })
    expect(payments).toEqual([])
  })

  it('leaves a payer\'s excess capacity unpaid when an absorption shrinks total owed below total owing — they simply keep it', () => {
    // a owes 100 total, but b is only owed 92 (an absorption already covered
    // 8 of what would otherwise be owed). a should pay out only 92, not 100.
    // Only one payer here, so there's no one to consolidate through.
    const { payments } = minimizeSettlement({ a: 100, b: -92 })
    expect(payments).toEqual([{ from: 'a', to: 'b', amount: 92 }])
  })

  describe('consolidating through the biggest payer\'s standing balance', () => {
    // a=70, b=30 owers (a is bigger, so a consolidates); x=60, y=40 owed.
    // a alone can't cover y (70-60=10 left, y needs 40) without help from b.
    const nets = { a: 70, b: 30, x: -60, y: -40 }

    it('still avoids splitting even with zero standing balance — b just pays a\'s shortfall in full, in real cash', () => {
      const { payments, consolidationAbsorptions } = minimizeSettlement(nets)
      expect(payments.filter(p => p.to === 'x')).toHaveLength(1)
      expect(payments.filter(p => p.to === 'y')).toHaveLength(1)
      expect(payments.find(p => p.to === 'y')?.from).toBe('a')
      expect(payments.find(p => p.from === 'b' && p.to === 'a')?.amount).toBe(30)
      expect(consolidationAbsorptions).toEqual({})
    })

    it('reduces what b needs to pay by whatever a\'s balance can safely absorb — the reimbursement floor applied to consolidation', () => {
      const { payments, consolidationAbsorptions } = minimizeSettlement(nets, { a: 10 })
      expect(payments.filter(p => p.to === 'y')).toHaveLength(1) // still never split
      // a absorbs 10 of b's 30 share; b only pays the remaining 20 for real.
      expect(payments.find(p => p.from === 'b' && p.to === 'a')?.amount).toBe(20)
      expect(consolidationAbsorptions).toEqual({ a: 10 })
    })

    it('needs no real payment from b at all when a\'s balance can absorb the whole gap', () => {
      const { payments, consolidationAbsorptions } = minimizeSettlement(nets, { a: 100 })
      expect(payments.find(p => p.from === 'b' && p.to === 'a')).toBeUndefined()
      expect(consolidationAbsorptions).toEqual({ a: 30 })
      // a still pays x and y in full, out of a's own resources.
      expect(payments.find(p => p.to === 'x')).toEqual({ from: 'a', to: 'x', amount: 60 })
      expect(payments.find(p => p.to === 'y')).toEqual({ from: 'a', to: 'y', amount: 40 })
    })
  })

  it('reproduces the real pooled example — Harsh, who already has plenty of balance, pays everyone directly and absorbs Raga\'s share entirely; she pays nothing', () => {
    const nets = { harsh: 49_308, raga: 13_003, you: -21_491, brao: -21_491, sujju: -9_665, adi: -9_664 }
    const { payments, consolidationAbsorptions } = minimizeSettlement(nets, { harsh: 300_000 })
    for (const recipient of ['you', 'brao', 'sujju', 'adi']) {
      const paymentsToThem = payments.filter(p => p.to === recipient)
      expect(paymentsToThem).toHaveLength(1)
      expect(paymentsToThem[0].from).toBe('harsh')
    }
    // Harsh's balance comfortably covers Raga's whole share, so she doesn't
    // pay him anything for real — it's absorbed and deducted from his own
    // recorded balance instead (see splitShows / consolidationAbsorptions).
    expect(payments.find(p => p.from === 'raga')).toBeUndefined()
    expect(consolidationAbsorptions).toEqual({ harsh: 13_003 })
    expect(payments).toHaveLength(4) // just the 4 direct payments — no reimbursement transaction needed
  })
})

describe('minimizeSettlement — recipient self-satisfaction from their own tagged Band Fund', () => {
  it('fully self-satisfies when their fund balance covers the whole amount owed to them — no real payment needed', () => {
    const { payments, selfSatisfactions } = minimizeSettlement({ a: 100, z: -30 }, { z: 50 })
    expect(selfSatisfactions).toEqual({ z: 30 })
    expect(payments.find(p => p.to === 'z')).toBeUndefined()
  })

  it('partially self-satisfies, and the real payment only covers the shortfall', () => {
    const { payments, selfSatisfactions } = minimizeSettlement({ a: 100, z: -30 }, { z: 10 })
    expect(selfSatisfactions).toEqual({ z: 10 })
    expect(payments.find(p => p.to === 'z')?.amount).toBe(20)
  })

  it('exposes the unrouted remaining position — what each person actually still owes or is owed, independent of who pays whom', () => {
    const { remainingNets } = minimizeSettlement({ a: 100, z: -30 }, { z: 10 })
    // z was owed 30, self-satisfied 10 of it, so only -20 is left to receive.
    expect(remainingNets).toEqual({ a: 100, z: -20 })
  })

  it('needs the full real payment when the recipient holds no fund at all', () => {
    const { payments, selfSatisfactions } = minimizeSettlement({ a: 100, z: -30 })
    expect(selfSatisfactions).toEqual({})
    expect(payments.find(p => p.to === 'z')?.amount).toBe(30)
  })
})

describe('minimizeSettlement — the consolidation hub is picked by tagged Band Fund balance, not by who owes the most', () => {
  it('prefers the smaller-obligation payer as hub when they hold more Band Fund', () => {
    // Harsh owes less (30) than Raga (70), but holds far more Band Fund —
    // he should still be the one who ends up paying x and y directly.
    const nets = { harsh: 30, raga: 70, x: -60, y: -40 }
    const { payments, consolidationAbsorptions } = minimizeSettlement(nets, { harsh: 1_000_000, raga: 0 })
    expect(payments.filter(p => p.to === 'x')).toHaveLength(1)
    expect(payments.filter(p => p.to === 'y')).toHaveLength(1)
    expect(payments.find(p => p.to === 'x')?.from).toBe('harsh')
    expect(payments.find(p => p.to === 'y')?.from).toBe('harsh')
    // Harsh's fund comfortably absorbs Raga's whole 70 — she pays nothing for real.
    expect(payments.find(p => p.from === 'raga')).toBeUndefined()
    expect(consolidationAbsorptions).toEqual({ harsh: 70 })
  })
})

describe('computeShowSettlementNets (full BMC show, end to end)', () => {
  it('matches the proposal\'s worked example — always fully reimburses what was fronted, and always balances to zero', () => {
    const { memberShares, bandFundAmount } = computeEntitlements(148_000, ['aditya', 'kavya', 'rohan', 'meera', 'vikram'], 20)
    const nets = computeShowSettlementNets({
      involvedMemberIds: ['aditya', 'kavya', 'rohan', 'meera', 'vikram'],
      entitlements: memberShares,
      bandFundAmount,
      bandFundHolderId: 'aditya',
      cashPositions: { aditya: 170_000, kavya: -10_000, rohan: -12_000, meera: 0, vikram: 0 },
    })
    expect(nets).toEqual({
      aditya: 116_720, kavya: -33_680, rohan: -35_680, meera: -23_680, vikram: -23_680,
    })
    expect(Object.values(nets).reduce((s, n) => s + n, 0)).toBeCloseTo(0)
  })

  it('reduces what a fronting member is owed by their absorbed amount — payers don\'t send cash the member already has', () => {
    const { memberShares, bandFundAmount } = computeEntitlements(148_000, ['aditya', 'kavya', 'rohan', 'meera', 'vikram'], 20)
    // Rohan started this batch at 8,000 and fronted 12,000 — his own balance
    // covers 8,000 of it (computeAbsorbedAmount), so the real settlement
    // only needs to pay back the 4,000 shortfall, on top of his entitlement.
    const absorbed = computeAbsorbedAmount(8_000, 12_000)
    expect(absorbed).toBe(8_000)
    const nets = computeShowSettlementNets({
      involvedMemberIds: ['aditya', 'kavya', 'rohan', 'meera', 'vikram'],
      entitlements: memberShares,
      bandFundAmount,
      bandFundHolderId: 'aditya',
      cashPositions: { aditya: 170_000, kavya: -10_000, rohan: -12_000, meera: 0, vikram: 0 },
      absorptions: { rohan: absorbed },
    })
    expect(nets.rohan).toBe(-27_680) // -35,680 + 8,000 absorbed
    // Nobody else's net position depends on Rohan's own prior balance — an
    // absorption is a self-contained reduction, not a cost shifted to
    // whoever happens to be paying.
    expect(nets.aditya).toBe(116_720)
    expect(nets.kavya).toBe(-33_680)
  })

  it('leaves a fronting member exactly at their real wallet entitlement once the reduced settlement is paid — no separate correction needed', () => {
    // Rohan: starts holding 8,000, fronts 12,000 of it (down to -4,000 of
    // his own money), then receives the absorption-reduced settlement
    // (his 4,000 shortfall + his 23,680 entitlement = 27,680 real cash).
    const absorbed = computeAbsorbedAmount(8_000, 12_000)
    const nets = computeShowSettlementNets({
      involvedMemberIds: ['rohan'],
      entitlements: { rohan: 23_680 },
      bandFundAmount: 0,
      bandFundHolderId: 'aditya',
      cashPositions: { rohan: -12_000 },
      absorptions: { rohan: absorbed },
    })
    const realCashReceived = -nets.rohan
    expect(realCashReceived).toBe(27_680)
    const finalWallet = 8_000 /* standing, real cash in hand */ - 12_000 /* fronted */ + realCashReceived
    expect(finalWallet).toBe(23_680) // exactly his entitlement
  })
})

describe('poolSettlementNets (multi-show batching)', () => {
  it('sums per-show nets so opposing positions cancel — the two-show worked example', () => {
    const bmcNets = { aditya: 116_720, kavya: -33_680, rohan: -35_680, meera: -23_680, vikram: -23_680 }
    const collegeFestNets = { kavya: 43_200, aditya: -21_600, sanya: -21_600 }
    const pooled = poolSettlementNets([bmcNets, collegeFestNets])
    expect(pooled).toEqual({
      aditya: 95_120, kavya: 9_520, rohan: -35_680, meera: -23_680, vikram: -23_680, sanya: -21_600,
    })
  })
})
