import { describe, it, expect } from 'vitest'
import {
  bucketTaskIds, positionBetween, nextBucketPosition, myTaskGroup,
  compareOpenTasks, buildPeople,
} from './tasks'
import type { Task } from '@/types/tasks'

const task = (over: Partial<Task>) => ({ id: 't', bucket_id: 'b1', position: 1, due_date: null, priority: 'medium', ...over }) as unknown as Task

describe('bucketTaskIds', () => {
  it("returns only that bucket's tasks in position order", () => {
    const tasks = [
      task({ id: 'x', bucket_id: 'b1', position: 3 }),
      task({ id: 'y', bucket_id: 'b2', position: 1 }),
      task({ id: 'z', bucket_id: 'b1', position: 1.5 }),
    ]
    expect(bucketTaskIds(tasks, 'b1')).toEqual(['z', 'x'])
  })
})

describe('positionBetween', () => {
  it('handles an empty bucket, the top, the bottom and the middle', () => {
    expect(positionBetween(undefined, undefined)).toBe(1)
    expect(positionBetween(undefined, 5)).toBe(4)
    expect(positionBetween(5, undefined)).toBe(6)
    expect(positionBetween(2, 4)).toBe(3)
  })

  it('keeps splitting without ever colliding with a neighbour', () => {
    let next = 2
    for (let i = 0; i < 40; i++) {
      const p = positionBetween(1, next)
      expect(p).toBeGreaterThan(1)
      expect(p).toBeLessThan(next)
      next = p
    }
  })
})

describe('nextBucketPosition', () => {
  it('goes after the last bucket, or starts at 1', () => {
    expect(nextBucketPosition([])).toBe(1)
    expect(nextBucketPosition([{ position: 1 }, { position: 4 }])).toBe(5)
  })
})

describe('myTaskGroup', () => {
  const today = '2026-10-02'
  const weekAhead = '2026-10-09'
  it('files a task by its due date relative to today', () => {
    expect(myTaskGroup(null, today, weekAhead)).toBe('no_date')
    expect(myTaskGroup('2026-10-01', today, weekAhead)).toBe('overdue')
    expect(myTaskGroup('2026-10-02', today, weekAhead)).toBe('today')
    expect(myTaskGroup('2026-10-09', today, weekAhead)).toBe('upcoming')
    expect(myTaskGroup('2026-10-10', today, weekAhead)).toBe('later')
  })
})

describe('compareOpenTasks', () => {
  it('sorts by due date with undated last, then by priority', () => {
    const sorted = [
      task({ id: 'undated', due_date: null, priority: 'urgent' }),
      task({ id: 'late-low', due_date: '2026-10-05', priority: 'low' }),
      task({ id: 'late-urgent', due_date: '2026-10-05', priority: 'urgent' }),
      task({ id: 'early', due_date: '2026-10-03', priority: 'low' }),
    ].sort(compareOpenTasks)
    expect(sorted.map(t => t.id)).toEqual(['early', 'late-urgent', 'late-low', 'undated'])
  })
})

describe('buildPeople', () => {
  it('suffixes only the current user in the picker but keeps real names for lookups', () => {
    const { members, nameById } = buildPeople(
      [{ id: 'u1', display_name: 'Asha' }, { id: 'u2', display_name: null }],
      'u1'
    )
    expect(members).toEqual([{ id: 'u1', name: 'Asha (you)' }, { id: 'u2', name: 'Member' }])
    expect(nameById).toEqual({ u1: 'Asha', u2: 'Member' })
  })
})
