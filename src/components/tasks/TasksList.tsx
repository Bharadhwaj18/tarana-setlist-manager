'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, Check, Pencil, RotateCcw, Trash2, CheckCircle2, ChevronDown, FolderClosed, ListChecks, Plus, Search, SquareKanban, User } from 'lucide-react'
import { createBoard, createTask, deleteTask, setTaskProgress } from '@/actions/tasks'
import { LongPressMenu, type MenuItem } from '@/components/ui/LongPressMenu'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import { formatDateDMY } from '@/lib/dates'
import { compareOpenTasks } from '@/lib/tasks'
import { PRIORITY_CHIP, PRIORITY_LABELS, type Member, type Task, type TaskBoard, type TaskBucket, type TaskPriority } from '@/types/tasks'
import { Avatar } from './AssigneePicker'
import { ProgressToggle } from './TaskCard'
import { TaskModal } from './TaskModal'

interface Props {
  boards: TaskBoard[]
  buckets: TaskBucket[]
  tasks: Task[]
  members: Member[]
  nameById: Record<string, string>
  today: string
  currentUserId?: string
  initialMine?: boolean
}

const NEW_GROUP = '__new__'

/** The everyday Tasks view: one flat list across every group, with the group shown on each row. */
export function TasksList({ boards, buckets, tasks, members, nameById, today, currentUserId, initialMine = false }: Props) {
  const router = useRouter()
  const toast = useToast()
  const titleRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  const [query, setQuery] = useState('')
  const [onlyMine, setOnlyMine] = useState(initialMine)
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [showDone, setShowDone] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [addGroup, setAddGroup] = useState<string>(boards[0]?.id ?? NEW_GROUP)
  const [newGroupName, setNewGroupName] = useState('')

  const boardById = useMemo(() => Object.fromEntries(boards.map(b => [b.id, b])), [boards])
  const effectiveAddGroup = addGroup !== NEW_GROUP && !boardById[addGroup] ? (boards[0]?.id ?? NEW_GROUP) : addGroup

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tasks.filter(t => {
      if (!boardById[t.board_id]) return false
      if (groupFilter !== 'all' && t.board_id !== groupFilter) return false
      if (onlyMine && (!currentUserId || !t.assignee_ids.includes(currentUserId))) return false
      if (q && !t.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [tasks, boardById, groupFilter, onlyMine, currentUserId, query])

  const open = useMemo(() => visible.filter(t => t.progress !== 'completed').sort(compareOpenTasks), [visible])
  const completed = useMemo(
    () => visible.filter(t => t.progress === 'completed').sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    [visible]
  )
  const openTask = openTaskId ? tasks.find(t => t.id === openTaskId) : undefined

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    startTransition(async () => {
      let boardId = effectiveAddGroup
      if (boardId === NEW_GROUP) {
        const name = newGroupName.trim()
        if (!name) { toast('Name the group first', 'error'); return }
        const made = await createBoard(name)
        if (made.error || !made.id) { toast(made.error ?? 'Could not create the group', 'error'); return }
        boardId = made.id
        setAddGroup(made.id)
        setNewGroupName('')
      }
      const result = await createTask({ boardId, title: trimmed, dueDate: due || null, assigneeIds: currentUserId && onlyMine ? [currentUserId] : [] })
      if (result.error) { toast(result.error, 'error'); return }
      setTitle('')
      setDue('')
      router.refresh()
      titleRef.current?.focus()
    })
  }

  const filtersActive = onlyMine || groupFilter !== 'all' || query.trim() !== ''

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="rounded-2xl border border-brand-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Plus className="ml-1 h-5 w-5 shrink-0 text-gray-400" />
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Add a task and press Enter"
            aria-label="New task"
            className="min-w-[10rem] flex-1 bg-transparent py-2 text-base text-gray-900 placeholder-gray-400 focus:outline-none"
          />
          <input
            type="date"
            value={due}
            onChange={e => setDue(e.target.value)}
            aria-label="Due date"
            className="compact-field rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-brand-400 focus:outline-none"
          />
          <div className="relative">
            <select
              value={effectiveAddGroup}
              onChange={e => setAddGroup(e.target.value)}
              aria-label="Group"
              className="compact-field appearance-none rounded-lg border border-brand-200 bg-white py-1.5 pl-3 pr-8 text-sm font-semibold text-gray-700 focus:border-brand-400 focus:outline-none"
            >
              {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              <option value={NEW_GROUP}>+ New group…</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <button
            type="submit"
            disabled={isPending || !title.trim()}
            className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {effectiveAddGroup === NEW_GROUP && (
          <input
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            placeholder="Group name, e.g. Album release, Admin, Merch"
            aria-label="New group name"
            className="mt-2 w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none"
          />
        )}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[10rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tasks"
            aria-label="Search tasks"
            className="w-full rounded-lg border border-brand-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>
        {currentUserId && (
          <button
            type="button"
            role="switch"
            aria-checked={onlyMine}
            onClick={() => setOnlyMine(v => !v)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors',
              onlyMine ? 'border-brand-400 bg-brand-400 text-white' : 'border-brand-200 bg-white text-gray-700 hover:bg-brand-50'
            )}
          >
            <span className={cn('flex h-5 w-5 items-center justify-center rounded-full', onlyMine ? 'bg-white/20' : 'bg-brand-100 text-gray-500')}>
              {onlyMine ? <Check className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            </span>
            Assigned to me
          </button>
        )}
        <GroupFilter boards={boards} tasks={tasks} value={groupFilter} onChange={setGroupFilter} />
        {groupFilter !== 'all' && (
          <Link href={`/tasks/${groupFilter}`} className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-gray-900">
            <SquareKanban className="h-3.5 w-3.5" /> Open as board
          </Link>
        )}
        {filtersActive && (
          <button type="button" onClick={() => { setQuery(''); setOnlyMine(false); setGroupFilter('all') }} className="text-xs font-semibold text-gray-500 hover:underline">
            Clear
          </button>
        )}
      </div>

      {boards.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-10 w-10" />}
          title="No tasks yet"
          description="Type a task above. Pick a group like “Admin” or “Album release” (or create one) to keep things tidy."
        />
      ) : open.length === 0 && completed.length === 0 ? (
        <EmptyState icon={<CheckCircle2 className="h-10 w-10" />} title={filtersActive ? 'No tasks match' : 'Nothing to do'} description={filtersActive ? 'Try clearing the filters.' : 'Add your first task above.'} />
      ) : (
        <>
          {open.length > 0 ? (
            <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-200 bg-white">
              {open.map(t => <TaskRow key={t.id} task={t} group={boardById[t.board_id].name} today={today} nameById={nameById} onOpen={() => setOpenTaskId(t.id)} onGroup={() => setGroupFilter(t.board_id)} />)}
            </ul>
          ) : (
            <p className="rounded-2xl border border-brand-200 bg-white px-4 py-6 text-center text-sm text-gray-500">All caught up.</p>
          )}

          {completed.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowDone(v => !v)} className="mb-2 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-gray-500 hover:text-gray-700">
                <ChevronDown className={cn('h-4 w-4 transition-transform', !showDone && '-rotate-90')} /> Completed ({completed.length})
              </button>
              {showDone && (
                <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-200 bg-white">
                  {completed.slice(0, 50).map(t => <TaskRow key={t.id} task={t} group={boardById[t.board_id].name} today={today} nameById={nameById} onOpen={() => setOpenTaskId(t.id)} onGroup={() => setGroupFilter(t.board_id)} />)}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {openTask && boardById[openTask.board_id] && (
        <TaskModal
          key={openTask.id}
          task={openTask}
          buckets={buckets.filter(b => b.board_id === openTask.board_id).sort((a, b) => a.position - b.position)}
          labels={boardById[openTask.board_id].labels}
          members={members}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </div>
  )
}

function TaskRow({ task, group, today, nameById, onOpen, onGroup }: { task: Task; group: string; today: string; nameById: Record<string, string>; onOpen: () => void; onGroup: () => void }) {
  const done = task.progress === 'completed'
  const overdue = !done && !!task.due_date && task.due_date < today
  const priority = task.priority as TaskPriority
  const doneItems = task.checklist.filter(c => c.done).length
  const menu: MenuItem[] = [
    { label: 'Open', icon: Pencil, onSelect: onOpen },
    { label: done ? 'Mark as not started' : 'Mark as done', icon: done ? RotateCcw : CheckCircle2, onSelect: () => { void setTaskProgress(task.id, done ? 'not_started' : 'completed') } },
    { label: 'Delete', icon: Trash2, danger: true, onSelect: () => { if (window.confirm(`Delete "${task.title}"?`)) void deleteTask(task.id) } },
  ]

  return (
    <li className="hover:bg-brand-50">
      <LongPressMenu title={task.title} items={menu} className="flex items-center gap-3 px-4 py-3">
      <ProgressToggle task={task} />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className={cn('truncate text-sm font-semibold', done ? 'text-gray-400 line-through' : 'text-gray-900')}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
          <span
            role="link"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onGroup() }}
            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onGroup() } }}
            className="rounded-full bg-brand-100 px-2 py-0.5 font-bold text-gray-700 hover:bg-brand-200"
          >
            {group}
          </span>
          {task.due_date && (
            <span className={cn('inline-flex items-center gap-1', overdue && 'font-bold text-red-600')}>
              <CalendarDays className="h-3 w-3" /> {formatDateDMY(task.due_date)}
            </span>
          )}
          {priority !== 'medium' && !done && <span className={cn('rounded px-1.5 py-0.5 font-bold', PRIORITY_CHIP[priority])}>{PRIORITY_LABELS[priority]}</span>}
          {task.checklist.length > 0 && <span className="inline-flex items-center gap-1"><ListChecks className="h-3 w-3" /> {doneItems}/{task.checklist.length}</span>}
        </div>
      </button>
      {task.assignee_ids.length > 0 && (
        <span className="flex shrink-0 -space-x-1.5">
          {task.assignee_ids.slice(0, 3).map(id => <Avatar key={id} name={nameById[id] ?? 'Member'} />)}
        </span>
      )}
      </LongPressMenu>
    </li>
  )
}

/** Group picker: a real menu with a count per group instead of the browser's plain select. */
function GroupFilter({ boards, tasks, value, onChange }: { boards: TaskBoard[]; tasks: Task[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const openCount = (id: string) => tasks.filter(t => t.board_id === id && t.progress !== 'completed').length
  const current = boards.find(b => b.id === value)
  const pick = (id: string) => { onChange(id); setOpen(false) }

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors',
          current ? 'border-brand-400 bg-brand-400 text-white' : 'border-brand-200 bg-white text-gray-700 hover:bg-brand-50'
        )}
      >
        <FolderClosed className="h-4 w-4" />
        <span className="max-w-[10rem] truncate">{current ? current.name : 'All groups'}</span>
        <ChevronDown className={cn('h-4 w-4 opacity-70 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <ul role="listbox" className="absolute left-0 z-40 mt-2 max-h-72 w-64 overflow-y-auto rounded-2xl border border-brand-200 bg-white py-1.5 shadow-xl">
            <li>
              <button type="button" role="option" aria-selected={value === 'all'} onClick={() => pick('all')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50">
                <span className="flex-1 font-semibold text-gray-900">All groups</span>
                <span className="text-xs text-gray-400">{tasks.filter(t => t.progress !== 'completed').length}</span>
                {value === 'all' && <Check className="h-4 w-4 text-brand-600" />}
              </button>
            </li>
            {boards.length > 0 && <li className="my-1 border-t border-brand-100" />}
            {boards.map(b => (
              <li key={b.id}>
                <button type="button" role="option" aria-selected={value === b.id} onClick={() => pick(b.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50">
                  <span className={cn('flex-1 truncate', value === b.id ? 'font-bold text-gray-900' : 'font-medium text-gray-700')}>{b.name}</span>
                  <span className="text-xs text-gray-400">{openCount(b.id)}</span>
                  {value === b.id && <Check className="h-4 w-4 text-brand-600" />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
