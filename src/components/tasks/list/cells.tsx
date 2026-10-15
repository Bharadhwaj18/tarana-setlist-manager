'use client'

import { useState } from 'react'
import { CheckSquare2, Circle, CircleDot, Square, UserPlus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_TEXT } from '@/lib/task-view'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { CellMenu } from './CellMenu'
import {
  PRIORITY_CHIP, PRIORITY_LABELS, TASK_PRIORITIES, customValue, fieldOptions,
  type Member, type Task, type TaskBoard, type TaskBucket, type TaskField, type TaskPriority, type TaskProgress,
} from '@/types/tasks'
import type { TaskPatch } from '@/actions/tasks'

export interface CellContext {
  boards: TaskBoard[]
  buckets: TaskBucket[]
  members: Member[]
  nameById: Record<string, string>
  avatars: Record<string, string>
  today: string
  readOnly: boolean
  onPatch: (task: Task, patch: TaskPatch) => void
}

const STATUS_TONE: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-sky-100 text-sky-800',
  completed: 'bg-emerald-100 text-emerald-800',
}
const STATUS_ICON: Record<string, typeof Circle> = { not_started: Circle, in_progress: CircleDot, completed: CheckSquare2 }

export function StatusPill({ progress }: { progress: string }) {
  const Icon = STATUS_ICON[progress] ?? Circle
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-extrabold', STATUS_TONE[progress] ?? STATUS_TONE.not_started)}>
      <Icon className="h-3 w-3" strokeWidth={2.6} />{STATUS_TEXT[progress] ?? progress}
    </span>
  )
}

export function PriorityPill({ priority }: { priority: string }) {
  const p = (TASK_PRIORITIES as readonly string[]).includes(priority) ? (priority as TaskPriority) : 'medium'
  return <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-extrabold', PRIORITY_CHIP[p])}>{PRIORITY_LABELS[p]}</span>
}

/** The tick on the left of every row: done or not. */
export function DoneToggle({ task, c, size = 20 }: { task: Task; c: CellContext; size?: number }) {
  const done = task.progress === 'completed'
  const Icon = done ? CheckSquare2 : Square
  return (
    <button type="button" disabled={c.readOnly} aria-label={done ? `Mark “${task.title}” not done` : `Mark “${task.title}” done`} aria-pressed={done}
      onClick={e => { e.stopPropagation(); c.onPatch(task, { progress: done ? 'not_started' : 'completed' }) }}
      className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg disabled:cursor-default', done ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600')}>
      <Icon style={{ width: size, height: size }} strokeWidth={2} />
    </button>
  )
}

/** Click to rename; Enter or clicking away saves, Escape cancels. */
export function InlineText({ value, label, placeholder, onSave, readOnly, className, type = 'text' }: {
  value: string; label: string; placeholder?: string; onSave: (v: string) => void; readOnly?: boolean; className?: string; type?: 'text' | 'number'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  if (editing) {
    const commit = () => { setEditing(false); if (draft.trim() !== value) onSave(draft.trim()) }
    return (
      <input autoFocus type={type} value={draft} aria-label={label} onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        onClick={e => e.stopPropagation()}
        className={cn('min-h-9 w-full min-w-0 rounded-lg border-2 border-brand-400 bg-white px-2 text-sm font-bold text-gray-900 focus:outline-none', className)} />
    )
  }
  return (
    <button type="button" disabled={readOnly} aria-label={`${label}: ${value || 'empty'}. Edit`}
      onClick={e => { e.stopPropagation(); setDraft(value); setEditing(true) }}
      className={cn('min-h-9 w-full min-w-0 truncate rounded-lg px-1 text-left disabled:cursor-default', !readOnly && 'hover:bg-brand-50', className)}>
      {value || <span className="font-semibold text-gray-400">{placeholder ?? 'Add'}</span>}
    </button>
  )
}

export function StatusCell({ task, c }: { task: Task; c: CellContext }) {
  return (
    <CellMenu label="Status" disabled={c.readOnly} trigger={<StatusPill progress={task.progress} />} value={task.progress}
      options={['not_started', 'in_progress', 'completed'].map(s => ({ value: s, label: <StatusPill progress={s} /> }))}
      onChange={v => c.onPatch(task, { progress: v as TaskProgress })} />
  )
}

export function PriorityCell({ task, c }: { task: Task; c: CellContext }) {
  return (
    <CellMenu label="Priority" disabled={c.readOnly} trigger={<PriorityPill priority={task.priority} />} value={task.priority}
      options={TASK_PRIORITIES.map(p => ({ value: p, label: <PriorityPill priority={p} /> }))}
      onChange={v => c.onPatch(task, { priority: v })} />
  )
}

export function Faces({ ids, c, size = 26 }: { ids: string[]; c: CellContext; size?: number }) {
  if (!ids.length) return <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-400"><UserPlus className="h-4 w-4" />Add</span>
  return (
    <span className="flex">
      {ids.slice(0, 3).map((id, i) => (
        <span key={id} className={cn('rounded-full ring-2 ring-white', i > 0 && '-ml-1.5')}>
          <UserAvatar name={c.nameById[id] ?? 'Member'} id={id} avatarUrl={c.avatars[id]} size={size} />
        </span>
      ))}
      {ids.length > 3 && <span className="ml-1 self-center text-xs font-bold text-gray-500">+{ids.length - 3}</span>}
    </span>
  )
}

export function PeopleCell({ task, c, size }: { task: Task; c: CellContext; size?: number }) {
  return (
    <CellMenu label="Who’s doing it" multiple disabled={c.readOnly} trigger={<Faces ids={task.assignee_ids} c={c} size={size} />} value={task.assignee_ids}
      options={c.members.map(m => ({ value: m.id, label: <span className="flex items-center gap-2"><UserAvatar name={m.name} id={m.id} avatarUrl={c.avatars[m.id]} size={22} />{m.name}</span> }))}
      onChange={id => c.onPatch(task, { assigneeIds: task.assignee_ids.includes(id) ? task.assignee_ids.filter(a => a !== id) : [...task.assignee_ids, id] })} />
  )
}

/** "14 Oct" (plus the year when it isn't this year and there's room). */
export function shortDate(iso: string, withYear = false) {
  const d = new Date(iso + 'T00:00:00Z')
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear()
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', ...(withYear && !sameYear ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(d)
}

/** A date that opens the device's own date picker. */
export function DateCell({ value, label, overdue, onChange, readOnly, compact }: { value: string | null; label: string; overdue?: boolean; onChange: (v: string | null) => void; readOnly?: boolean; compact?: boolean }) {
  return (
    <span className="relative inline-flex min-h-8 items-center gap-1">
      <span className={cn('whitespace-nowrap text-sm font-bold', overdue ? 'text-red-600' : value ? 'text-gray-800' : 'text-gray-400')}>
        {value ? shortDate(value, !compact) : 'Add date'}
      </span>
      {!readOnly && (
        <input type="date" aria-label={label} value={value ?? ''} onChange={e => onChange(e.target.value || null)} onClick={e => e.stopPropagation()}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      )}
      {value && !readOnly && (
        <button type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={e => { e.stopPropagation(); onChange(null) }} className="relative z-10 rounded p-0.5 text-gray-300 hover:text-gray-600">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

export function GroupCell({ task, c }: { task: Task; c: CellContext }) {
  const board = c.boards.find(b => b.id === task.board_id)
  return (
    <CellMenu label="Group" disabled={c.readOnly} trigger={<span className="truncate px-1 text-sm font-bold text-gray-800">{board?.name ?? 'Group'}</span>} value={task.board_id}
      options={c.boards.map(b => ({ value: b.id, label: b.name }))}
      onChange={v => c.onPatch(task, { boardId: v })} />
  )
}

export function BucketCell({ task, c }: { task: Task; c: CellContext }) {
  const buckets = c.buckets.filter(b => b.board_id === task.board_id).sort((a, b) => a.position - b.position)
  const current = buckets.find(b => b.id === task.bucket_id)
  return (
    <CellMenu label="Bucket" disabled={c.readOnly} trigger={<span className="truncate px-1 text-sm font-semibold text-gray-600">{current?.name ?? 'Bucket'}</span>} value={task.bucket_id}
      options={buckets.map(b => ({ value: b.id, label: b.name }))}
      onChange={v => c.onPatch(task, { bucketId: v })} />
  )
}

/** One of the workspace's own columns, drawn and edited according to its type. */
export function CustomCell({ task, field, c }: { task: Task; field: TaskField; c: CellContext }) {
  const value = customValue(task, field.id)
  const save = (v: string | number | boolean | null) => c.onPatch(task, { custom: { fieldId: field.id, value: v } })

  if (field.type === 'checkbox') {
    const on = value === true
    const Icon = on ? CheckSquare2 : Square
    return (
      <button type="button" disabled={c.readOnly} aria-label={`${field.name}: ${on ? 'yes' : 'no'}`} aria-pressed={on} onClick={e => { e.stopPropagation(); save(!on) }}
        className={cn('flex h-9 w-9 items-center justify-center rounded-lg', on ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600')}>
        <Icon className="h-5 w-5" />
      </button>
    )
  }
  if (field.type === 'select') {
    return (
      <CellMenu label={field.name} disabled={c.readOnly} value={typeof value === 'string' ? value : null}
        trigger={value ? <span className="truncate rounded-full bg-brand-100 px-2 py-0.5 text-xs font-extrabold text-gray-800">{String(value)}</span> : <span className="px-1 text-sm font-semibold text-gray-400">Choose</span>}
        options={fieldOptions(field).map(o => ({ value: o, label: o }))}
        onChange={v => save(v === value ? null : v)} />
    )
  }
  if (field.type === 'person') {
    const id = typeof value === 'string' ? value : null
    return (
      <CellMenu label={field.name} disabled={c.readOnly} value={id}
        trigger={id ? <span className="flex items-center gap-1.5 px-1 text-sm font-bold"><UserAvatar name={c.nameById[id] ?? 'Member'} id={id} avatarUrl={c.avatars[id]} size={22} /><span className="truncate">{c.nameById[id] ?? 'Member'}</span></span> : <span className="px-1 text-sm font-semibold text-gray-400">Choose</span>}
        options={c.members.map(m => ({ value: m.id, label: m.name }))}
        onChange={v => save(v === id ? null : v)} />
    )
  }
  if (field.type === 'date') {
    return <DateCell value={typeof value === 'string' ? value : null} label={field.name} onChange={save} readOnly={c.readOnly} compact />
  }
  return (
    <InlineText value={value === null ? '' : String(value)} label={field.name} type={field.type === 'number' ? 'number' : 'text'} readOnly={c.readOnly}
      className="text-sm font-semibold text-gray-800"
      onSave={v => save(field.type === 'number' ? (v === '' || Number.isNaN(Number(v)) ? null : Number(v)) : v)} />
  )
}
