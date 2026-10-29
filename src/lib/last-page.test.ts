import { describe, expect, it } from 'vitest'
import { lastPageFor, resumeTarget } from './last-page'

describe('lastPageFor', () => {
  it('remembers Today and section pages', () => {
    expect(lastPageFor('/')).toBe('/')
    expect(lastPageFor('/finance')).toBe('/finance')
    expect(lastPageFor('/finance/history')).toBe('/finance')
    expect(lastPageFor('/shows/abc-123')).toBe('/shows')
    expect(lastPageFor('/event-management/x')).toBe('/event-management')
  })
  it('skips pages that are not a section', () => {
    expect(lastPageFor('/settings')).toBeNull()
    expect(lastPageFor('/more')).toBeNull()
    expect(lastPageFor('/choose-workspace')).toBeNull()
  })
  it('does not mix up pages that share a prefix', () => {
    expect(lastPageFor('/financeX')).toBeNull()
  })
})

describe('resumeTarget', () => {
  it('goes to the saved section', () => {
    expect(resumeTarget('/finance', [])).toBe('/finance')
  })
  it('stays on Today when nothing useful is saved', () => {
    expect(resumeTarget(undefined, [])).toBeNull()
    expect(resumeTarget('/', [])).toBeNull()
    expect(resumeTarget('/admin', [])).toBeNull()
  })
  it('stays on Today when the section is hidden for this member', () => {
    expect(resumeTarget('/finance', ['finance'])).toBeNull()
  })
})
