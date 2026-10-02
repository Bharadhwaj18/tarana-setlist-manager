import { describe, it, expect } from 'vitest'
import { taskInputSchema, boardNameSchema, labelInputSchema } from './validators'

const id = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'
const valid = {
  title: 'Book the van',
  description: null,
  bucketId: id,
  progress: 'not_started',
  priority: 'medium',
  startDate: null,
  dueDate: null,
  remindDaysBefore: null,
  recurrence: null,
  assigneeIds: [],
  labelIds: [],
  checklist: [],
}

describe('taskInputSchema', () => {
  it('accepts a minimal task', () => {
    expect(taskInputSchema.safeParse(valid).success).toBe(true)
  })

  it('trims the title and rejects a blank one', () => {
    expect(taskInputSchema.parse({ ...valid, title: '  Van  ' }).title).toBe('Van')
    expect(taskInputSchema.safeParse({ ...valid, title: '   ' }).success).toBe(false)
  })

  it('rejects a start date after the due date, but allows equal or one-sided dates', () => {
    expect(taskInputSchema.safeParse({ ...valid, startDate: '2026-10-05', dueDate: '2026-10-01' }).success).toBe(false)
    expect(taskInputSchema.safeParse({ ...valid, startDate: '2026-10-05', dueDate: '2026-10-05' }).success).toBe(true)
    expect(taskInputSchema.safeParse({ ...valid, startDate: '2026-10-05' }).success).toBe(true)
  })

  it('rejects unknown progress/priority values, malformed dates and non-uuid assignees', () => {
    expect(taskInputSchema.safeParse({ ...valid, progress: 'blocked' }).success).toBe(false)
    expect(taskInputSchema.safeParse({ ...valid, priority: 'critical' }).success).toBe(false)
    expect(taskInputSchema.safeParse({ ...valid, dueDate: '5 Oct' }).success).toBe(false)
    expect(taskInputSchema.safeParse({ ...valid, assigneeIds: ['nope'] }).success).toBe(false)
  })

  it('bounds the reminder lead time', () => {
    expect(taskInputSchema.safeParse({ ...valid, remindDaysBefore: -1 }).success).toBe(false)
    expect(taskInputSchema.safeParse({ ...valid, remindDaysBefore: 3 }).success).toBe(true)
  })
})

describe('boardNameSchema / labelInputSchema', () => {
  it('requires a trimmed, non-empty name', () => {
    expect(boardNameSchema.parse('  Album  ')).toBe('Album')
    expect(boardNameSchema.safeParse('  ').success).toBe(false)
    expect(labelInputSchema.safeParse({ name: 'Gig', color: 'blue' }).success).toBe(true)
    expect(labelInputSchema.safeParse({ name: 'Gig', color: 'chartreuse' }).success).toBe(false)
  })
})
