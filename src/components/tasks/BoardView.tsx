'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeft, Pencil, SquareKanban, Table2, Trash2 } from 'lucide-react'
import { deleteBoard, renameBoard } from '@/actions/tasks'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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
  initialTaskId?: string
}

type View = 'board' | 'grid'

export function BoardView({ board, data, members, nameById, today, initialTaskId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const toast = useToast()
  const [view, setView] = useState<View>('board')
  const [openTaskId, setOpenTaskId] = useState<string | null>(initialTaskId ?? null)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(board.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  const tasks = data.tasks
  const labels = board.labels
  const labelsById = useMemo(() => Object.fromEntries(labels.map(l => [l.id, l])), [labels])
  const buckets: TaskBucket[] = data.buckets
  const openTask = openTaskId ? tasks.find(t => t.id === openTaskId) : undefined

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
    startTransition(async () => {
      const result = await deleteBoard(board.id)
      if (result.error) toast(result.error, 'error')
      else {
        toast('Board deleted', 'success')
        router.push('/tasks')
      }
    })
  }

  const open = tasks.filter(t => t.progress !== 'completed').length

  return (
    <div>
      <Link href="/tasks" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> All boards
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
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
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-bold text-gray-900">{board.name}</h1>
              <button type="button" onClick={() => setRenaming(true)} className="rounded p-1 text-gray-400 hover:bg-brand-50 hover:text-brand-500" aria-label="Rename board">
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="mt-0.5 text-sm text-gray-500">{open} open · {tasks.length - open} completed</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-brand-200 bg-white p-0.5" role="group" aria-label="View">
            {([['board', 'Board', SquareKanban], ['grid', 'Grid', Table2]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cn('inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium', view === key ? 'bg-brand-400 text-white' : 'text-gray-600 hover:bg-brand-50')}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          <LabelsManager boardId={board.id} labels={labels} />
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Delete board and its {tasks.length} task{tasks.length === 1 ? '' : 's'}?</span>
              <Button variant="danger" size="sm" onClick={remove} loading={isPending}>Delete</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Keep</Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      {view === 'board' ? (
        <KanbanBoard boardId={board.id} buckets={buckets} tasks={tasks} labelsById={labelsById} nameById={nameById} today={today} onOpenTask={setOpenTaskId} />
      ) : (
        <TaskGrid buckets={buckets} tasks={tasks} labelsById={labelsById} nameById={nameById} today={today} onOpenTask={setOpenTaskId} />
      )}

      {openTask && (
        <TaskModal key={openTask.id} task={openTask} buckets={[...buckets].sort((a, b) => a.position - b.position)} labels={labels} members={members} onClose={closeTask} />
      )}
    </div>
  )
}
