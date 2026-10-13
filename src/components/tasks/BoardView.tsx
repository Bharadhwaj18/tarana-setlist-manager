'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeft, MoreHorizontal, Pencil, Search, SquareKanban, Table2, Trash2 } from 'lucide-react'
import { deleteBoard, renameBoard } from '@/actions/tasks'
import { Input } from '@/components/ui/Input'
import { Chip } from '@/components/ui/Chip'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import { KanbanBoard } from './KanbanBoard'
import { TaskGrid } from './TaskGrid'
import { TaskModal } from './TaskModal'
import { LabelsManager } from './LabelsManager'
import type { Member, TaskBoard, TaskBucket, TaskData } from '@/types/tasks'

interface Props {
  board: TaskBoard
  /** This board's slice of the workspace task data. */
  data: TaskData
  members: Member[]
  nameById: Record<string, string>
  today: string
  currentUserId?: string
  initialTaskId?: string
}

type View = 'board' | 'grid'

export function BoardView({ board, data, members, nameById, today, currentUserId, initialTaskId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const toast = useToast()
  const [view, setView] = useState<View>('board')
  const [openTaskId, setOpenTaskId] = useState<string | null>(initialTaskId ?? null)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(board.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [hideDone, setHideDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  const allTasks = data.tasks
  const labels = board.labels
  const labelsById = useMemo(() => Object.fromEntries(labels.map(l => [l.id, l])), [labels])
  const buckets: TaskBucket[] = data.buckets
  const openTask = openTaskId ? allTasks.find(t => t.id === openTaskId) : undefined

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allTasks.filter(t => {
      if (hideDone && t.progress === 'completed') return false
      if (onlyMine && (!currentUserId || !t.assignee_ids.includes(currentUserId))) return false
      if (onlyOverdue && !(t.progress !== 'completed' && t.due_date && t.due_date < today)) return false
      if (q && !t.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [allTasks, query, onlyMine, onlyOverdue, hideDone, currentUserId, today])
  const isFiltered = filtered.length !== allTasks.length

  const closeTask = () => {
    setOpenTaskId(null)
    if (initialTaskId) window.history.replaceState(null, '', pathname)
  }

  const submitRename = () => {
    setRenaming(false)
    if (!name.trim() || name.trim() === board.name) { setName(board.name); return }
    startTransition(async () => {
      const result = await renameBoard(board.id, name)
      if (result.error) { toast(result.error, 'error'); setName(board.name) }
    })
  }

  const remove = () => {
    setMenuOpen(false)
    if (!window.confirm(`Delete "${board.name}" and its ${allTasks.length} task${allTasks.length === 1 ? '' : 's'}? This can’t be undone.`)) return
    startTransition(async () => {
      const result = await deleteBoard(board.id)
      if (result.error) toast(result.error, 'error')
      else {
        toast('Board deleted', 'success')
        router.push('/tasks')
      }
    })
  }

  const done = allTasks.filter(t => t.progress === 'completed').length
  const pct = allTasks.length ? Math.round((done / allTasks.length) * 100) : 0
  const overdueCount = allTasks.filter(t => t.progress !== 'completed' && t.due_date && t.due_date < today).length

  return (
    <div>
      <Link href="/tasks" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> All boards
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={submitRename}
              onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setName(board.name); setRenaming(false) } }}
              className="text-xl font-bold"
            />
          ) : (
            <h1 className="truncate text-3xl font-bold text-gray-900">{board.name}</h1>
          )}
          <div className="mt-2 flex max-w-sm items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-100">
              <div className="h-full rounded-full bg-brand-400" style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 text-xs font-semibold text-gray-500">{done} of {allTasks.length} done</span>
            {overdueCount > 0 && <span className="shrink-0 text-xs font-bold text-red-600">{overdueCount} overdue</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-brand-100 p-1" role="group" aria-label="View">
            {([['board', 'Board', SquareKanban], ['grid', 'List', Table2]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold', view === key ? 'bg-brand-400 text-white shadow-sm' : 'text-gray-700')}
              >
                <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <LabelsManager boardId={board.id} labels={labels} />
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Board options"
              aria-expanded={menuOpen}
              disabled={isPending}
              className="rounded-lg border border-brand-200 bg-white p-2 text-gray-600 hover:bg-brand-50"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-xl border border-brand-200 bg-white py-1 shadow-lg">
                  <button type="button" onClick={() => { setMenuOpen(false); setRenaming(true) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-brand-50">
                    <Pencil className="h-4 w-4" /> Rename board
                  </button>
                  <button type="button" onClick={remove} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" /> Delete board
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[11rem] flex-1 sm:max-w-xs">
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
        {currentUserId && <Chip active={onlyMine} onClick={() => setOnlyMine(v => !v)}>Assigned to me</Chip>}
        <Chip active={onlyOverdue} onClick={() => setOnlyOverdue(v => !v)}>Overdue</Chip>
        <Chip active={hideDone} onClick={() => setHideDone(v => !v)}>Hide completed</Chip>
        {isFiltered && (
          <button type="button" onClick={() => { setQuery(''); setOnlyMine(false); setOnlyOverdue(false); setHideDone(false) }} className="text-xs font-semibold text-gray-500 underline-offset-2 hover:underline">
            Clear filters ({filtered.length} shown)
          </button>
        )}
      </div>

      {view === 'board' ? (
        <KanbanBoard boardId={board.id} buckets={buckets} tasks={filtered} labelsById={labelsById} nameById={nameById} today={today} onOpenTask={setOpenTaskId} />
      ) : (
        <TaskGrid buckets={buckets} tasks={filtered} labelsById={labelsById} nameById={nameById} today={today} onOpenTask={setOpenTaskId} />
      )}

      {openTask && (
        <TaskModal key={openTask.id} task={openTask} buckets={[...buckets].sort((a, b) => a.position - b.position)} labels={labels} members={members} onClose={closeTask} />
      )}
    </div>
  )
}
