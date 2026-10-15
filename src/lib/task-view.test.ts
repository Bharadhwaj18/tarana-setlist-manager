import { describe, it, expect } from 'vitest'
import { DEFAULT_VIEW, activeFilterCount, filterTasks, groupTasks, sortTasks } from './task-view'
import type { Task, TaskBoard } from '@/types/tasks'

const task = (o: Partial<Task>): Task => ({
  workspace_id: 'w', id: Math.random().toString(36).slice(2), board_id: 'b1', bucket_id: 'k1', title: 'Task', description: null,
  progress: 'not_started', priority: 'medium', start_date: null, due_date: null, completed_at: null, position: 1,
  remind_days_before: null, recurrence: null, assignee_ids: [], label_ids: [], checklist: [], source_note_id: null,
  created_by: 'u', updated_by: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', custom: {}, ...o,
})
const ctx = { today: '2026-10-16', userId: 'me-id', boardIds: new Set(['b1', 'b2']) }

describe('filterTasks', () => {
  const list = [
    task({ title: 'Overdue', due_date: '2026-10-10', assignee_ids: ['me-id'] }),
    task({ title: 'This week', due_date: '2026-10-20', board_id: 'b2' }),
    task({ title: 'No date', assignee_ids: ['raga'] }),
    task({ title: 'Done', progress: 'completed', due_date: '2026-10-01' }),
    task({ title: 'Archived group', board_id: 'gone' }),
  ]

  it('drops tasks from groups that no longer exist', () => {
    expect(filterTasks(list, DEFAULT_VIEW, ctx).map(t => t.title)).not.toContain('Archived group')
  })
  it('filters by who, including "me"', () => {
    expect(filterTasks(list, { ...DEFAULT_VIEW, who: ['me'] }, ctx).map(t => t.title)).toEqual(['Overdue'])
    expect(filterTasks(list, { ...DEFAULT_VIEW, who: ['raga'] }, ctx).map(t => t.title)).toEqual(['No date'])
  })
  it('handles overdue, this week, no date and hide done', () => {
    expect(filterTasks(list, { ...DEFAULT_VIEW, show: ['overdue'] }, ctx).map(t => t.title)).toEqual(['Overdue'])
    expect(filterTasks(list, { ...DEFAULT_VIEW, show: ['week'] }, ctx).map(t => t.title)).toEqual(['This week'])
    expect(filterTasks(list, { ...DEFAULT_VIEW, show: ['nodate'] }, ctx).map(t => t.title)).toEqual(['No date'])
    expect(filterTasks(list, { ...DEFAULT_VIEW, show: ['hidedone'] }, ctx).map(t => t.title)).not.toContain('Done')
  })
  it('filters by group and search, and counts active filters', () => {
    expect(filterTasks(list, { ...DEFAULT_VIEW, groups: ['b2'] }, ctx).map(t => t.title)).toEqual(['This week'])
    expect(filterTasks(list, { ...DEFAULT_VIEW, query: 'week' }, ctx).map(t => t.title)).toEqual(['This week'])
    expect(activeFilterCount({ ...DEFAULT_VIEW, who: ['me'], show: ['hidedone', 'overdue'] })).toBe(3)
  })
})

describe('sortTasks and groupTasks', () => {
  it('sorts by due date with no date last', () => {
    const s = sortTasks([task({ title: 'none' }), task({ title: 'late', due_date: '2026-11-01' }), task({ title: 'soon', due_date: '2026-10-17' })], 'due')
    expect(s.map(t => t.title)).toEqual(['soon', 'late', 'none'])
  })
  it('sorts by priority, urgent first', () => {
    const s = sortTasks([task({ title: 'low', priority: 'low' }), task({ title: 'urgent', priority: 'urgent' })], 'priority')
    expect(s.map(t => t.title)).toEqual(['urgent', 'low'])
  })
  it('groups by status with Done folded away', () => {
    const sections = groupTasks([task({ progress: 'completed' }), task({ progress: 'in_progress' })], DEFAULT_VIEW, { boards: [], nameById: {} })
    expect(sections.map(s => [s.label, s.tasks.length, !!s.collapsedByDefault])).toEqual([['In progress', 1, false], ['Not started', 0, false], ['Done', 1, true]])
  })
  it('groups by person with nobody last', () => {
    const sections = groupTasks([task({ assignee_ids: [] }), task({ assignee_ids: ['r'] })], { ...DEFAULT_VIEW, groupBy: 'person' }, { boards: [] as TaskBoard[], nameById: { r: 'Raga' } })
    expect(sections.map(s => s.label)).toEqual(['Raga', 'Nobody yet'])
  })
})
