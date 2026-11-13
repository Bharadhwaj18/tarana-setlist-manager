import { describe, expect, it } from 'vitest'
import { isMerchCrewRow } from './merch-crew'

describe('isMerchCrewRow', () => {
  it('is true only for members marked as Merch crew', () => {
    expect(isMerchCrewRow({ role: 'member', permissions: { merch_crew: true } })).toBe(true)
    expect(isMerchCrewRow({ role: 'member', permissions: { merch_crew: false } })).toBe(false)
    expect(isMerchCrewRow({ role: 'member', permissions: {} })).toBe(false)
    expect(isMerchCrewRow({ role: 'member', permissions: null })).toBe(false)
  })
  it('never hides owners or admins', () => {
    expect(isMerchCrewRow({ role: 'admin', permissions: { merch_crew: true } })).toBe(false)
    expect(isMerchCrewRow({ role: 'owner', permissions: { merch_crew: true } })).toBe(false)
  })
})
