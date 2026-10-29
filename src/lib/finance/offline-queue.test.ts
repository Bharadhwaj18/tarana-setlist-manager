import { describe, expect, it } from 'vitest'
import { isNetworkError, parseQueue, queuedFor, type QueuedEntry } from './offline-queue'

const entry = (o: Partial<QueuedEntry> = {}): QueuedEntry => ({
  id: 'e1', workspaceId: 'w1', queuedAt: '2026-10-29T10:00:00.000Z', payload: { member_id: null, amount: -250, description: 'Chai' }, ...o,
})

describe('parseQueue', () => {
  it('reads saved entries', () => {
    expect(parseQueue(JSON.stringify([entry()]))).toEqual([entry()])
  })
  it('ignores empty, broken or malformed data', () => {
    expect(parseQueue(null)).toEqual([])
    expect(parseQueue('nope')).toEqual([])
    expect(parseQueue('{}')).toEqual([])
    expect(parseQueue(JSON.stringify([{ id: 'x' }, entry()]))).toEqual([entry()])
  })
})

describe('queuedFor', () => {
  it('keeps this workspace only, oldest first', () => {
    const q = [
      entry({ id: 'b', queuedAt: '2026-10-29T12:00:00.000Z' }),
      entry({ id: 'other', workspaceId: 'w2' }),
      entry({ id: 'a', queuedAt: '2026-10-29T09:00:00.000Z' }),
    ]
    expect(queuedFor(q, 'w1').map(e => e.id)).toEqual(['a', 'b'])
  })
})

describe('isNetworkError', () => {
  it('spots a request that never reached the server', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('NetworkError when attempting to fetch resource'))).toBe(true)
    expect(isNetworkError('Load failed')).toBe(true)
  })
  it('does not mistake other errors for it', () => {
    expect(isNetworkError(new Error('This show has already been split'))).toBe(false)
    expect(isNetworkError(undefined)).toBe(false)
  })
})
