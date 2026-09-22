import { describe, it, expect } from 'vitest'
import { computeTds } from './tds'

describe('computeTds', () => {
  it('grosses up a received amount by the withheld percentage', () => {
    const { tdsAmount, grossFee } = computeTds(90000, 10)
    expect(grossFee).toBeCloseTo(100000, 5)
    expect(tdsAmount).toBeCloseTo(10000, 5)
  })

  it('is 0 when nothing was received', () => {
    expect(computeTds(0, 10)).toEqual({ tdsAmount: 0, grossFee: 0 })
  })

  it('is a no-op at 0% TDS', () => {
    expect(computeTds(50000, 0)).toEqual({ tdsAmount: 0, grossFee: 50000 })
  })

  it('guards against a nonsensical 100%+ rate rather than dividing by zero or going negative', () => {
    expect(computeTds(50000, 100)).toEqual({ tdsAmount: 0, grossFee: 50000 })
    expect(computeTds(50000, 150)).toEqual({ tdsAmount: 0, grossFee: 50000 })
  })
})
