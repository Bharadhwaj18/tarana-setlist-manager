import { describe, it, expect } from 'vitest'
import { findDeadEndpoints } from './push'

function rejected(statusCode: number): PromiseSettledResult<unknown> {
  return { status: 'rejected', reason: { statusCode } }
}
function fulfilled(): PromiseSettledResult<unknown> {
  return { status: 'fulfilled', value: undefined }
}

describe('findDeadEndpoints', () => {
  const subs = [{ endpoint: 'a' }, { endpoint: 'b' }, { endpoint: 'c' }]

  it('prunes subscriptions that failed with 404 or 410', () => {
    expect(findDeadEndpoints(subs, [rejected(404), fulfilled(), rejected(410)])).toEqual(['a', 'c'])
  })

  it('keeps subscriptions that succeeded', () => {
    expect(findDeadEndpoints(subs, [fulfilled(), fulfilled(), fulfilled()])).toEqual([])
  })

  it('does not prune on other failure codes (transient errors should be retried, not deleted)', () => {
    expect(findDeadEndpoints(subs, [rejected(500), rejected(429), fulfilled()])).toEqual([])
  })

  it('handles a rejection with no statusCode at all', () => {
    const results: PromiseSettledResult<unknown>[] = [{ status: 'rejected', reason: new Error('network error') }, fulfilled(), fulfilled()]
    expect(findDeadEndpoints(subs, results)).toEqual([])
  })
})
