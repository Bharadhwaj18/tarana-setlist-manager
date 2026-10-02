'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, ArrowRight, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { createBucket, createTask, deleteBucket, moveBucket, moveTask, renameBucket } from '@/actions/tasks'
import { useToast } from '@/components/ui/Toaster'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { bucketTaskIds, byPosition, positionBetween } from '@/lib/tasks'
import { TaskCard } from './TaskCard'
import type { TaskBucket, TaskLabel, Task } from '@/types/tasks'

interface Props {
  boardId: string
  buckets: TaskBucket[]
  tasks: Task[]
  labelsById: Record<string, TaskLabel>
  nameById: Record<string, string>
  today: string
  onOpenTask: (id: string) => void
}

type Columns = Record<string, string[]>

function buildColumns(buckets: TaskBucket[], tasks: Task[]): Columns {
  return Object.fromEntries(buckets.map(b => [b.id, bucketTaskIds(tasks, b.id)]))
}

export function KanbanBoard({ boardId, buckets, tasks, labelsById, nameById, today, onOpenTask }: Props) {
  const sortedBuckets = useMemo(() => [...buckets].sort(byPosition), [buckets])
  const tasksById = useMemo(() => Object.fromEntries(tasks.map(t => [t.id, t])) as Record<string, Task>, [tasks])
  const propColumns = useMemo(() => buildColumns(sortedBuckets, tasks), [sortedBuckets, tasks])

  // Local copy so a drag moves cards instantly; it re-syncs whenever fresh server data arrives.
  const [columns, setColumns] = useState<Columns>(propColumns)
  const [prevProp, setPrevProp] = useState(propColumns)
  const [activeId, setActiveId] = useState<string | null>(null)
  if (propColumns !== prevProp && activeId === null) {
    setPrevProp(propColumns)
    setColumns(propColumns)
  }

  const toast = useToast()
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] } }),
  )

  const findContainer = (id: string): string | undefined =>
    id in columns ? id : Object.keys(columns).find(key => columns[key].includes(id))

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return
    const activeKey = String(active.id)
    const overKey = String(over.id)
    const from = findContainer(activeKey)
    const to = findContainer(overKey)
    if (!from || !to || from === to) return

    setColumns(prev => {
      const target = prev[to]
      let index: number
      if (overKey in prev) index = target.length
      else {
        const below = !!active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height / 2
        index = target.indexOf(overKey) + (below ? 1 : 0)
      }
      return {
        ...prev,
        [from]: prev[from].filter(id => id !== activeKey),
        [to]: [...target.slice(0, index), activeKey, ...target.slice(index)],
      }
    })
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    setActiveId(null)
    const activeKey = String(active.id)
    if (!over) {
      setColumns(propColumns)
      return
    }
    const overKey = String(over.id)
    const container = findContainer(activeKey)
    if (!container || container !== findContainer(overKey)) {
      setColumns(propColumns)
      return
    }

    let list = columns[container]
    const from = list.indexOf(activeKey)
    const to = overKey in columns ? from : list.indexOf(overKey)
    if (from !== to && to >= 0) list = arrayMove(list, from, to)
    setColumns(prev => ({ ...prev, [container]: list }))

    const index = list.indexOf(activeKey)
    const unchanged = tasksById[activeKey].bucket_id === container && propColumns[container].join() === list.join()
    if (unchanged) return

    const position = positionBetween(tasksById[list[index - 1]]?.position, tasksById[list[index + 1]]?.position)
    moveTask(activeKey, container, position).then(result => {
      if (result.error) {
        toast(result.error, 'error')
        setColumns(propColumns)
      }
    })
  }

  const activeTask = activeId ? tasksById[activeId] : null

  return (
    <DndContext
      id={`board-${boardId}`}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => { setActiveId(null); setColumns(propColumns) }}
    >
      <div className="flex items-start gap-4 overflow-x-auto pb-4">
        {sortedBuckets.map((bucket, i) => (
          <Column
            key={bucket.id}
            boardId={boardId}
            bucket={bucket}
            isFirst={i === 0}
            isLast={i === sortedBuckets.length - 1}
            canDelete={sortedBuckets.length > 1}
            taskIds={columns[bucket.id] ?? []}
            tasksById={tasksById}
            labelsById={labelsById}
            nameById={nameById}
            today={today}
            onOpenTask={onOpenTask}
          />
        ))}
        <AddBucket boardId={boardId} />
      </div>
      <DragOverlay>
        {activeTask && (
          <div className="rotate-2 cursor-grabbing">
            <TaskCard task={activeTask} labelsById={labelsById} nameById={nameById} today={today} onOpen={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

interface ColumnProps {
  boardId: string
  bucket: TaskBucket
  isFirst: boolean
  isLast: boolean
  canDelete: boolean
  taskIds: string[]
  tasksById: Record<string, Task>
  labelsById: Record<string, TaskLabel>
  nameById: Record<string, string>
  today: string
  onOpenTask: (id: string) => void
}

function Column({ boardId, bucket, isFirst, isLast, canDelete, taskIds, tasksById, labelsById, nameById, today, onOpenTask }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket.id })

  return (
    <section className="w-72 shrink-0 rounded-xl bg-brand-50/70 p-2.5">
      <BucketHeader bucket={bucket} count={taskIds.length} isFirst={isFirst} isLast={isLast} canDelete={canDelete} />
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={cn('min-h-[3rem] space-y-2 rounded-lg p-0.5 transition-colors', isOver && 'bg-brand-100/60')}>
          {taskIds.map(id => tasksById[id] && (
            <SortableCard key={id} task={tasksById[id]} labelsById={labelsById} nameById={nameById} today={today} onOpen={() => onOpenTask(id)} />
          ))}
        </div>
      </SortableContext>
      <QuickAdd boardId={boardId} bucketId={bucket.id} />
    </section>
  )
}

function SortableCard({ task, labelsById, nameById, today, onOpen }: { task: Task; labelsById: Record<string, TaskLabel>; nameById: Record<string, string>; today: string; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'opacity-30')}
      {...attributes}
      tabIndex={-1}
      {...listeners}
    >
      <TaskCard task={task} labelsById={labelsById} nameById={nameById} today={today} onOpen={onOpen} />
    </div>
  )
}

function BucketHeader({ bucket, count, isFirst, isLast, canDelete }: { bucket: TaskBucket; count: number; isFirst: boolean; isLast: boolean; canDelete: boolean }) {
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(bucket.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [, startTransition] = useTransition()
  const toast = useToast()

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await fn()
      if (result.error) toast(result.error, 'error')
    })

  const submitRename = () => {
    setRenaming(false)
    if (name.trim() && name.trim() !== bucket.name) run(() => renameBucket(bucket.id, name))
    else setName(bucket.name)
  }

  return (
    <div className="relative mb-2.5 flex items-center gap-2 px-1">
      {renaming ? (
        <Input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={submitRename}
          onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setName(bucket.name); setRenaming(false) } }}
          className="h-8 py-1"
        />
      ) : (
        <>
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{bucket.name}</h2>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-500">{count}</span>
          <button type="button" onClick={() => { setMenu(m => !m); setConfirmDelete(false) }} className="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-600" aria-label={`Options for ${bucket.name}`}>
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </>
      )}
      {menu && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} aria-label="Close menu" />
          <div className="absolute right-0 top-8 z-20 w-48 rounded-lg border border-gray-200 bg-white p-1 text-sm shadow-lg">
            <MenuItem icon={Pencil} onClick={() => { setMenu(false); setRenaming(true) }}>Rename</MenuItem>
            <MenuItem icon={ArrowLeft} disabled={isFirst} onClick={() => { setMenu(false); run(() => moveBucket(bucket.id, 'left')) }}>Move left</MenuItem>
            <MenuItem icon={ArrowRight} disabled={isLast} onClick={() => { setMenu(false); run(() => moveBucket(bucket.id, 'right')) }}>Move right</MenuItem>
            {confirmDelete ? (
              <div className="p-2">
                <p className="text-xs text-gray-600">Deletes this bucket and its {count} task{count === 1 ? '' : 's'}.</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="danger" onClick={() => { setMenu(false); run(() => deleteBucket(bucket.id)) }}>Delete</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button>
                </div>
              </div>
            ) : (
              <MenuItem icon={Trash2} disabled={!canDelete} danger onClick={() => setConfirmDelete(true)}>{canDelete ? 'Delete bucket' : 'Last bucket'}</MenuItem>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, children, onClick, disabled, danger }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn('flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40', danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700')}
    >
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  )
}

function QuickAdd({ boardId, bucketId }: { boardId: string; bucketId: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const submit = () => {
    if (!title.trim()) { setOpen(false); return }
    startTransition(async () => {
      const result = await createTask({ boardId, bucketId, title })
      if (result.error) { toast(result.error, 'error'); return }
      setTitle('')
    })
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-white hover:text-gray-700">
        <Plus className="h-4 w-4" /> Add task
      </button>
    )
  }
  return (
    <div className="mt-2 space-y-2">
      <Input
        autoFocus
        placeholder="Task title"
        value={title}
        disabled={isPending}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setTitle(''); setOpen(false) } }}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} loading={isPending} disabled={!title.trim()}>Add</Button>
        <Button size="sm" variant="ghost" onClick={() => { setTitle(''); setOpen(false) }}>Done</Button>
      </div>
    </div>
  )
}

function AddBucket({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const submit = () => {
    if (!name.trim()) { setOpen(false); return }
    startTransition(async () => {
      const result = await createBucket(boardId, name)
      if (result.error) { toast(result.error, 'error'); return }
      setName('')
      setOpen(false)
    })
  }

  return (
    <div className="w-72 shrink-0">
      {open ? (
        <div className="space-y-2 rounded-xl bg-brand-50/70 p-2.5">
          <Input
            autoFocus
            placeholder="Bucket name"
            value={name}
            disabled={isPending}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setName(''); setOpen(false) } }}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} loading={isPending} disabled={!name.trim()}>Add bucket</Button>
            <Button size="sm" variant="ghost" onClick={() => { setName(''); setOpen(false) }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-1.5 rounded-xl border-2 border-dashed border-brand-200 px-3 py-2.5 text-sm font-medium text-gray-500 hover:border-brand-300 hover:text-gray-700">
          <Plus className="h-4 w-4" /> Add bucket
        </button>
      )}
    </div>
  )
}
