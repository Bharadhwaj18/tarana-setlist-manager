import { describe, expect, it } from 'vitest'
import { parseLastEntry, resolveLastEntry } from './last-entry'

const allowed = {
  categories: (dir: 'credit' | 'debit') => (dir === 'credit' ? ['show_fee', 'merch'] : ['travel', 'misc']),
  accountValues: ['acct:bank'],
}

describe('parseLastEntry', () => {
  it('reads a saved choice', () => {
    expect(parseLastEntry('{"dir":"debit","category":"travel","holder":"acct:bank"}')).toEqual({ dir: 'debit', category: 'travel', holder: 'acct:bank' })
  })
  it('ignores empty, broken or unfamiliar values', () => {
    expect(parseLastEntry(null)).toBeNull()
    expect(parseLastEntry('not json')).toBeNull()
    expect(parseLastEntry('{"dir":"sideways"}')).toBeNull()
    expect(parseLastEntry('null')).toBeNull()
  })
  it('fills in what is missing', () => {
    expect(parseLastEntry('{"dir":"credit"}')).toEqual({ dir: 'credit', category: null, holder: '' })
  })
})

describe('resolveLastEntry', () => {
  it('keeps a choice that is still allowed', () => {
    expect(resolveLastEntry({ dir: 'debit', category: 'travel', holder: 'acct:bank' }, allowed)).toEqual({ dir: 'debit', category: 'travel', holder: 'acct:bank' })
  })
  it('drops a category that no longer exists in that direction', () => {
    expect(resolveLastEntry({ dir: 'credit', category: 'travel', holder: '' }, allowed)).toEqual({ dir: 'credit', category: null, holder: null })
  })
  it('drops an account that is gone', () => {
    expect(resolveLastEntry({ dir: 'debit', category: 'misc', holder: 'acct:old' }, allowed)?.holder).toBeNull()
  })
  it('does nothing without a saved choice', () => {
    expect(resolveLastEntry(null, allowed)).toBeNull()
  })
})
