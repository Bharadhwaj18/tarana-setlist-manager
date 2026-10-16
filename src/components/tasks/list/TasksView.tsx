'use client'

import { Fragment, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Columns3, List, NotebookPen, Plus, Search, SlidersHorizontal, SquareKanban } from 'lucide-react'
import { createBoard, createTask, patchTask, type TaskPatch } from '@/actions/tasks'
import { useToast } from '@/components/ui/Toaster'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { DEFAULT_VIEW, activeFilterCount, filterTasks, groupTasks, type TaskSection, type TaskViewState } from '@/lib/task-view'
import type { Member, Task, TaskBoard, TaskBucket, TaskField } from '@/types/tasks'
import { CellMenu } from './CellMenu'
import { AddColumnDialog } from './AddColumnDialog'
import { FilterSheet } from './FilterSheet'
import { RepeatBadge } from '../RepeatBadge'
import { TaskExtras } from './TaskExtras'
import {
  BucketCell, CustomCell, DateCell, DoneToggle, Faces, GroupCell, InlineText, PeopleCell, PriorityCell, StatusCell, recentTick, shortDate,
  type CellContext,
} from './cells'
import { KanbanPanel } from './KanbanPanel'

interface Props {
  boards: TaskBoard[]
  buckets: TaskBucket[]
  tasks: Task[]
  fields: TaskField[]
  members: Member[]
  nameById: Record<string, string>
  avatars: Record<string, string>
  today: string
  currentUserId?: string
  readOnly: boolean
  view: 'list' | 'kanban'
  kanbanGroupId?: string
  openTaskId?: string
  /** Opened from "All my tasks": show just yours this time. */
  onlyMine?: boolean
}

const VIEW_KEY = 'tasks-view-v2'
const HIDDEN_KEY = 'tasks-hidden-columns'

const BUILT_IN = [
  { key: 'status', label: 'Status', width: '140px' },
  { key: 'priority', label: 'Priority', width: '112px' },
  { key: 'who', label: 'Who', width: '104px' },
  { key: 'due', label: 'Due', width: '112px' },
  { key: 'group', label: 'Group', width: '130px' },
  { key: 'bucket', label: 'Bucket', width: '120px' },
] as const

function readJson<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? { ...fallback, ...JSON.parse(v) } : fallback } catch { return fallback }
}

/** Apply an edit to the task on screen straight away; the server catches up behind it. */
function applyPatch(t: Task, p: TaskPatch, buckets: TaskBucket[]): Task {
  const next = { ...t }
  if (p.title !== undefined) next.title = p.title
  if (p.progress !== undefined) { next.progress = p.progress; next.completed_at = p.progress === 'completed' ? (t.completed_at ?? new Date().toISOString()) : null }
  if (p.priority !== undefined) next.priority = p.priority
  if (p.dueDate !== undefined) next.due_date = p.dueDate
  if (p.startDate !== undefined) next.start_date = p.startDate
  if (p.assigneeIds !== undefined) next.assignee_ids = p.assigneeIds
  if (p.description !== undefined) next.description = p.description
  if (p.checklist !== undefined) next.checklist = p.checklist.map(c => ({ id: c.id ?? crypto.randomUUID(), text: c.text, done: c.done }))
  if (p.boardId !== undefined && p.boardId !== t.board_id) {
    next.board_id = p.boardId
    next.bucket_id = buckets.filter(b => b.board_id === p.boardId).sort((a, b) => a.position - b.position)[0]?.id ?? t.bucket_id
  } else if (p.bucketId !== undefined) next.bucket_id = p.bucketId
  if (p.custom) {
    const c = { ...((t.custom && typeof t.custom === 'object' && !Array.isArray(t.custom)) ? t.custom as Record<string, unknown> : {}) }
    if (p.custom.value === null || p.custom.value === '') delete c[p.custom.fieldId]
    else c[p.custom.fieldId] = p.custom.value
    next.custom = c as Task['custom']
  }
  return next
}

export function TasksView(props: Props) {
  const { boards, buckets, fields, members, nameById, avatars, today, currentUserId, readOnly } = props
  const router = useRouter()
  const toast = useToast()
  const [, startTransition] = useTransition()

  const [view, setView] = useState<TaskViewState>(DEFAULT_VIEW)
  const [hidden, setHidden] = useState<string[]>([])
  // Saved per device; read after the first render so the server and browser agree.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(v => ({ ...readJson(VIEW_KEY, DEFAULT_VIEW), query: v.query, ...(props.onlyMine ? { who: ['me'] } : {}) }))
    try { setHidden(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]')) } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const changeView = (v: TaskViewState) => {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ ...v, query: '' })) } catch { /* private mode */ }
  }
  const toggleHidden = (key: string) => {
    const next = hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key]
    setHidden(next)
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)) } catch { /* private mode */ }
  }

  // Edits made here that the server hasn't sent back yet.
  const [patches, setPatches] = useState<Record<string, TaskPatch[]>>({})
  const [baseTasks, setBaseTasks] = useState(props.tasks)
  if (baseTasks !== props.tasks) { setBaseTasks(props.tasks); setPatches({}) }
  const tasks = useMemo(
    () => baseTasks.map(t => (patches[t.id] ?? []).reduce((acc, p) => applyPatch(acc, p, buckets), t)),
    [baseTasks, patches, buckets],
  )

  const onPatch = (task: Task, patch: TaskPatch) => {
    setPatches(prev => ({ ...prev, [task.id]: [...(prev[task.id] ?? []), patch] }))
    startTransition(async () => {
      const res = await patchTask(task.id, patch)
      if (res.error) {
        toast(res.error, 'error')
        setPatches(prev => ({ ...prev, [task.id]: (prev[task.id] ?? []).filter(p => p !== patch) }))
        return
      }
      router.refresh()
    })
  }

  const c: CellContext = { boards, buckets, members, nameById, avatars, today, readOnly, onPatch }
  const boardIds = useMemo(() => new Set(boards.map(b => b.id)), [boards])
  const shown = useMemo(() => filterTasks(tasks, view, { today, userId: currentUserId, boardIds }), [tasks, view, today, currentUserId, boardIds])
  const sections = useMemo(() => groupTasks(shown, view, { boards, nameById }), [shown, view, boards, nameById])

  const [filterOpen, setFilterOpen] = useState(false)
  const [columnDialog, setColumnDialog] = useState<{ field?: TaskField } | null>(null)
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(props.openTaskId ?? null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const isCollapsed = (s: TaskSection) => collapsed[s.key] ?? !!s.collapsedByDefault

  const openCount = tasks.filter(t => t.progress !== 'completed' && boardIds.has(t.board_id)).length
  const overdue = tasks.filter(t => t.progress !== 'completed' && t.due_date && t.due_date < today && boardIds.has(t.board_id)).length
  const filters = activeFilterCount(view)

  const visibleBuiltIns = BUILT_IN.filter(col => !hidden.includes(col.key))
  const visibleFields = fields.filter(f => !hidden.includes(f.id))
  const gridTemplate = ['44px', 'minmax(220px,1fr)', ...visibleBuiltIns.map(col => col.width), ...visibleFields.map(() => '130px'), '44px', '44px'].join(' ')

  const viewTabs = (
    <div role="tablist" aria-label="View" className="flex rounded-xl bg-brand-100 p-1">
      {([['list', 'List', List], ['kanban', 'Kanban', SquareKanban]] as const).map(([key, label, Icon]) => (
        <Link key={key} role="tab" aria-selected={props.view === key} href={key === 'list' ? '/tasks' : `/tasks?view=kanban${props.kanbanGroupId ? `&group=${props.kanbanGroupId}` : ''}`}
          className={cn('flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-extrabold transition-colors', props.view === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
          <Icon className="h-4 w-4" />{label}
        </Link>
      ))}
    </div>
  )

  const header = (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-bold text-gray-900">Tasks</h1>
        <p className="mt-0.5 hidden text-sm text-gray-500 sm:block">{openCount} open across {boards.length} {boards.length === 1 ? 'group' : 'groups'}{overdue > 0 && <> · <span className="font-bold text-red-600">{overdue} overdue</span></>}</p>
      </div>
      {viewTabs}
    </div>
  )

  if (boards.length === 0) {
    return (
      <div>
        {header}
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand-200 px-6 py-14 text-center">
          <p className="font-bold text-gray-800">No task groups yet</p>
          <p className="max-w-sm text-sm text-gray-500">Groups keep related tasks together, like “Gig prep” or “Merch”. Make your first one to start adding tasks.</p>
          {!readOnly && <button type="button" onClick={() => setNewGroupOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-400 px-4 text-sm font-extrabold text-white hover:bg-brand-500"><Plus className="h-4 w-4" />New group</button>}
        </div>
        <NewGroupDialog open={newGroupOpen} onOpenChange={setNewGroupOpen} />
      </div>
    )
  }

  if (props.view === 'kanban') {
    return (
      <div>
        {header}
        <KanbanPanel boards={boards} buckets={buckets} tasks={shown} members={members} nameById={nameById} today={today} groupId={props.kanbanGroupId}
          readOnly={readOnly} onNewGroup={() => setNewGroupOpen(true)}
          toolbar={<FilterButton count={filters} onClick={() => setFilterOpen(true)} />} />
        <FilterSheet open={filterOpen} onOpenChange={setFilterOpen} view={view} onChange={changeView} members={members} boards={boards} currentUserId={currentUserId} shownCount={shown.length} />
        <NewGroupDialog open={newGroupOpen} onOpenChange={setNewGroupOpen} />
      </div>
    )
  }

  const addTarget = (s: TaskSection): { boardId: string; extra: TaskPatch } => {
    const fallback = view.groups.length === 1 ? view.groups[0] : boards[0].id
    if (view.groupBy === 'group') return { boardId: s.key, extra: {} }
    if (view.groupBy === 'status' && s.key !== 'not_started') return { boardId: fallback, extra: { progress: s.key as Task['progress'] as TaskPatch['progress'] } }
    if (view.groupBy === 'priority') return { boardId: fallback, extra: { priority: s.key } }
    return { boardId: fallback, extra: {} }
  }

  return (
    <div>
      {header}

      {/* Toolbar: search and one Filter button; on desktop, the columns too. */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative min-w-0 flex-1 lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="search" value={view.query} onChange={e => setView({ ...view, query: e.target.value })} placeholder="Search tasks" aria-label="Search tasks"
            className="min-h-10 w-full rounded-xl border border-brand-200 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400" />
        </div>
        <FilterButton count={filters} onClick={() => setFilterOpen(true)} />
        <div className="hidden lg:block">
          <CellMenu label="Show or hide columns" multiple value={[...BUILT_IN.map(col => col.key), ...fields.map(f => f.id)].filter(k => !hidden.includes(k))}
            className="min-h-10 rounded-xl border border-brand-200 bg-white px-3"
            trigger={<span className="flex items-center gap-1.5 text-sm font-extrabold text-gray-800"><Columns3 className="h-4 w-4" />Columns</span>}
            options={[...BUILT_IN.map(col => ({ value: col.key as string, label: col.label })), ...fields.map(f => ({ value: f.id, label: f.name }))]}
            onChange={toggleHidden}
            footer={!readOnly ? <button type="button" onClick={() => setColumnDialog({})} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-2.5 text-sm font-bold text-brand-700 hover:bg-brand-50"><Plus className="h-4 w-4" />Add a column</button> : undefined} />
        </div>
        <span className="hidden text-sm text-gray-500 xl:inline">{view.query || filters ? `${shown.length} shown` : ''}</span>
      </div>

      {/* ---------- Desktop: a table you edit in place ---------- */}
      <div className="hidden overflow-x-auto rounded-2xl border border-brand-200 bg-white lg:block">
        <div role="table" aria-label="Tasks" className="min-w-max">
          <div role="row" className="grid items-center bg-brand-50 text-[11px] font-extrabold uppercase tracking-[0.1em] text-gray-500" style={{ gridTemplateColumns: gridTemplate }}>
            <span role="columnheader" />
            <span role="columnheader" className="px-2 py-2.5">Task</span>
            {visibleBuiltIns.map(col => <span key={col.key} role="columnheader" className="px-2 py-2.5">{col.label}</span>)}
            {visibleFields.map(f => (
              <span key={f.id} role="columnheader" className="px-1 py-1">
                <button type="button" disabled={readOnly} onClick={() => setColumnDialog({ field: f })} className="w-full truncate rounded-lg px-1 py-1.5 text-left uppercase hover:bg-brand-100" title="Rename, change options or remove">{f.name}</button>
              </span>
            ))}
            <span role="columnheader" className="flex justify-center">
              {!readOnly && <button type="button" aria-label="Add a column" onClick={() => setColumnDialog({})} className="flex h-7 w-7 items-center justify-center rounded-lg border-[1.5px] border-dashed border-gray-300 text-gray-500 hover:bg-brand-100"><Plus className="h-4 w-4" /></button>}
            </span>
            <span role="columnheader" />
          </div>

          {sections.map(s => (
            <Fragment key={s.key}>
              {view.groupBy !== 'none' && (
                <SectionHeader s={s} collapsed={isCollapsed(s)} onToggle={() => setCollapsed(prev => ({ ...prev, [s.key]: !isCollapsed(s) }))} className="border-t border-brand-200 px-3 py-2.5" />
              )}
              {!isCollapsed(s) && s.tasks.map(t => (
                <Fragment key={t.id}>
                  <div role="row" data-task-row className={cn('animate-row-in grid items-center border-t border-brand-100', expanded === t.id && 'bg-brand-50/60')} style={{ gridTemplateColumns: gridTemplate }}>
                    <span role="cell" className="flex justify-center"><DoneToggle task={t} c={c} /></span>
                    <span role="cell" className="min-w-0 px-1">
                      <InlineText value={t.title} label="Task name" readOnly={readOnly} onSave={v => v && onPatch(t, { title: v })}
                        className={cn('text-sm font-bold', t.progress === 'completed' ? cn('strike-draw text-gray-400', recentTick(t.id) && 'animate-strike-draw') : 'text-gray-900')} />
                    </span>
                    {visibleBuiltIns.map(col => (
                      <span key={col.key} role="cell" className="min-w-0 px-1">
                        {col.key === 'status' && <StatusCell task={t} c={c} />}
                        {col.key === 'priority' && <PriorityCell task={t} c={c} />}
                        {col.key === 'who' && <PeopleCell task={t} c={c} />}
                        {col.key === 'due' && <span className="flex min-w-0 items-center gap-1.5"><RepeatBadge recurrence={t.recurrence} /><DateCell value={t.due_date} label="Due date" readOnly={readOnly} overdue={t.progress !== 'completed' && !!t.due_date && t.due_date < today} onChange={v => onPatch(t, { dueDate: v })} /></span>}
                        {col.key === 'group' && <GroupCell task={t} c={c} />}
                        {col.key === 'bucket' && <BucketCell task={t} c={c} />}
                      </span>
                    ))}
                    {visibleFields.map(f => <span key={f.id} role="cell" className="min-w-0 px-1"><CustomCell task={t} field={f} c={c} /></span>)}
                    <span role="cell" />
                    <span role="cell" className="flex justify-center">
                      <button type="button" aria-expanded={expanded === t.id} aria-label={expanded === t.id ? 'Close notes and checklist' : 'Open notes and checklist'}
                        onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                        className={cn('flex h-8 w-8 items-center justify-center rounded-lg hover:bg-brand-100', t.description || t.checklist.length ? 'text-brand-600' : 'text-gray-300')}>
                        <NotebookPen className="h-4 w-4" />
                      </button>
                    </span>
                  </div>
                  {expanded === t.id && <div className="border-t border-brand-100 bg-brand-50/60 px-14 py-4"><TaskExtras task={t} c={c} /></div>}
                </Fragment>
              ))}
              {!isCollapsed(s) && !readOnly && <AddTaskRow boards={boards} target={addTarget(s)} className="border-t border-brand-100 pl-12" />}
            </Fragment>
          ))}
          {shown.length === 0 && <p className="border-t border-brand-100 px-4 py-10 text-center text-sm text-gray-500">No tasks match. Try clearing a filter.</p>}
        </div>
      </div>

      {/* ---------- Phone: quiet rows that open in place ---------- */}
      <div className="space-y-3 lg:hidden">
        {sections.map(s => (
          <section key={s.key}>
            {view.groupBy !== 'none' && (
              <SectionHeader s={s} collapsed={isCollapsed(s)} onToggle={() => setCollapsed(prev => ({ ...prev, [s.key]: !isCollapsed(s) }))} className="px-1 pb-2 pt-1" />
            )}
            {!isCollapsed(s) && (
              <div className="overflow-hidden rounded-2xl border border-brand-200 bg-white">
                {s.tasks.map((t, i) => (
                  <PhoneRow key={t.id} task={t} c={c} fields={fields} last={i === s.tasks.length - 1 && readOnly}
                    open={expanded === t.id} onToggle={() => setExpanded(expanded === t.id ? null : t.id)} onPatch={onPatch} />
                ))}
                {!readOnly && <AddTaskRow boards={boards} target={addTarget(s)} className="pl-3" />}
              </div>
            )}
          </section>
        ))}
        {shown.length === 0 && <p className="rounded-2xl border-2 border-dashed border-brand-200 px-4 py-10 text-center text-sm text-gray-500">No tasks match. Try clearing a filter.</p>}

      </div>

      <FilterSheet open={filterOpen} onOpenChange={setFilterOpen} view={view} onChange={changeView} members={members} boards={boards} currentUserId={currentUserId} shownCount={shown.length} />
      {columnDialog && <AddColumnDialog key={columnDialog.field?.id ?? 'new'} open onOpenChange={o => { if (!o) setColumnDialog(null) }} field={columnDialog.field} />}
      <NewGroupDialog open={newGroupOpen} onOpenChange={setNewGroupOpen} />
    </div>
  )
}

function FilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-extrabold text-gray-800', count ? 'border-brand-400 bg-brand-100' : 'border-brand-200 bg-white hover:bg-brand-50')}>
      <SlidersHorizontal className="h-4 w-4" />Filter
      {count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-400 px-1.5 text-[11px] text-white">{count}</span>}
    </button>
  )
}

function SectionHeader({ s, collapsed, onToggle, className }: { s: TaskSection; collapsed: boolean; onToggle: () => void; className?: string }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={!collapsed}
      className={cn('flex w-full items-center gap-2 text-left text-xs font-extrabold uppercase tracking-[0.1em] text-gray-500 hover:text-gray-800', className)}>
      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      {s.label}<span className="text-gray-400">{s.tasks.length}</span>
    </button>
  )
}

function PhoneRow({ task: t, c, fields, open, onToggle, last, onPatch }: { task: Task; c: CellContext; fields: TaskField[]; open: boolean; onToggle: () => void; last: boolean; onPatch: CellContext['onPatch'] }) {
  const overdue = t.progress !== 'completed' && !!t.due_date && t.due_date < c.today
  return (
    <div data-task-row className={cn('animate-row-in', !last && 'border-b border-brand-100', open && 'bg-brand-50/60')}>
      <div className="flex min-h-[58px] items-center gap-1 py-1.5 pl-1.5 pr-1">
        <DoneToggle task={t} c={c} size={22} />
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-[15px] font-bold', t.progress === 'completed' ? cn('strike-draw text-gray-400', recentTick(t.id) && 'animate-strike-draw') : 'text-gray-900')}>{t.title}</span>
            <span className={cn('block text-xs font-bold', overdue ? 'text-red-600' : t.due_date ? 'text-gray-500' : 'text-gray-400')}>
              <span className="inline-flex flex-wrap items-center gap-x-2">{t.due_date ? `${overdue ? 'Overdue · ' : 'Due '}${shortDate(t.due_date)}` : 'No date'}<RepeatBadge recurrence={t.recurrence} /></span>
            </span>
          </span>
          {t.assignee_ids.length > 0 && <Faces ids={t.assignee_ids} c={c} size={26} />}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center text-gray-400">{open ? <ChevronDown className="h-4 w-4 rotate-180" /> : <ChevronDown className="h-4 w-4" />}</span>
        </button>
      </div>

      {/* Always mounted, so closing can ease shut; inert while closed so nothing inside can be reached by Tab. */}
      <div inert={!open} className={cn('grid transition-[grid-template-rows] duration-300 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="min-h-0 overflow-hidden">
        <div className="space-y-3 pb-4 pl-12 pr-3">
          {!c.readOnly && <InlineText value={t.title} label="Task name" onSave={v => v && onPatch(t, { title: v })} className="text-sm font-bold text-gray-900" />}
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusCell task={t} c={c} />
            <PriorityCell task={t} c={c} />
            <span className="inline-flex items-center rounded-full bg-brand-100 px-2"><DateCell value={t.due_date} label="Due date" readOnly={c.readOnly} overdue={overdue} onChange={v => onPatch(t, { dueDate: v })} /></span>
            <span className="inline-flex items-center rounded-full bg-brand-100 px-1"><PeopleCell task={t} c={c} size={22} /></span>
          </div>
          <div className="divide-y divide-brand-100 overflow-hidden rounded-xl border border-brand-200 bg-white">
            <Line label="Group"><GroupCell task={t} c={c} /></Line>
            <Line label="Bucket"><BucketCell task={t} c={c} /></Line>
            {fields.map(f => <Line key={f.id} label={f.name}><CustomCell task={t} field={f} c={c} /></Line>)}
          </div>
          <TaskExtras task={t} c={c} />
        </div>
        </div>
      </div>
    </div>
  )
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 pl-3 pr-1">
      <span className="shrink-0 text-[13px] font-bold text-gray-500">{label}</span>
      <span className="flex min-w-0 justify-end">{children}</span>
    </div>
  )
}

/** "Add a task" at the bottom of a section: type a name, press Enter. Lands in that section. */
function AddTaskRow({ boards, target, className }: { boards: TaskBoard[]; target: { boardId: string; extra: TaskPatch }; className?: string }) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [boardId, setBoardId] = useState(target.boardId)
  const [pending, startTransition] = useTransition()
  const board = boards.find(b => b.id === boardId) ?? boards[0]

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    startTransition(async () => {
      const res = await createTask({ boardId: board.id, title })
      if (res.error || !res.id) { toast(res.error ?? 'Couldn’t add that task', 'error'); return }
      if (Object.keys(target.extra).length) await patchTask(res.id, target.extra)
      setTitle('')
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn('flex min-h-11 w-full items-center gap-2 text-left text-sm font-bold text-gray-500 hover:text-gray-800', className)}>
        <Plus className="h-4 w-4" />Add a task
      </button>
    )
  }
  return (
    <form onSubmit={add} className={cn('flex flex-wrap items-center gap-2 py-2 pr-3', className)}>
      <Input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs doing?" aria-label="New task name"
        onKeyDown={e => { if (e.key === 'Escape') { setTitle(''); setOpen(false) } }} className="min-h-10 min-w-[12rem] flex-1" />
      {boards.length > 1 && (
        <CellMenu label="Group for the new task" value={board.id} className="min-h-10 rounded-xl border border-brand-200 bg-white px-2.5"
          trigger={<span className="text-sm font-bold text-gray-800">{board.name}</span>}
          options={boards.map(b => ({ value: b.id, label: b.name }))} onChange={setBoardId} />
      )}
      <button type="submit" disabled={pending || !title.trim()} className="min-h-10 rounded-xl bg-brand-400 px-4 text-sm font-extrabold text-white hover:bg-brand-500 disabled:opacity-50">Add</button>
      <button type="button" onClick={() => { setTitle(''); setOpen(false) }} className="min-h-10 rounded-xl px-3 text-sm font-bold text-gray-500 hover:bg-brand-50">Cancel</button>
    </form>
  )
}

export function NewGroupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter()
  const toast = useToast()
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await createBoard(name)
      if (res.error) { toast(res.error, 'error'); return }
      toast('Group created', 'success')
      setName('')
      onOpenChange(false)
      router.refresh()
    })
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New group" description="Keeps related tasks together, like “Gig prep” or “Merch”."
      className="max-w-md max-sm:top-auto max-sm:bottom-0 max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-3xl">
      <form onSubmit={save} className="mt-4 space-y-4">
        <Input autoFocus value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Group name" aria-label="Group name" className="min-h-12 text-base" />
        <button type="submit" disabled={pending || !name.trim()} className="min-h-12 w-full rounded-2xl bg-brand-400 text-[15px] font-extrabold text-white hover:bg-brand-500 disabled:opacity-50">Create group</button>
      </form>
    </Modal>
  )
}
