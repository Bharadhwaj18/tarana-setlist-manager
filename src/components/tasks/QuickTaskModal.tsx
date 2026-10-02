'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { useToast } from '@/components/ui/Toaster'
import { createTask } from '@/actions/tasks'
import { AssigneePicker } from './AssigneePicker'
import type { Member } from '@/types/tasks'

interface Props {
  boards: { id: string; name: string }[]
  members: Member[]
  open: boolean
  onOpenChange: (open: boolean) => void
  dueDate?: string
}

const selectClass = 'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

export function QuickTaskModal({ boards, members, open, onOpenChange, dueDate }: Props) {
  const [boardId, setBoardId] = useState(boards[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(dueDate ?? '')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  // Fresh form each time it opens ("adjust state during render", no effect).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setBoardId(prev => (boards.some(b => b.id === prev) ? prev : boards[0]?.id ?? ''))
      setTitle('')
      setDue(dueDate ?? '')
      setAssigneeIds([])
      setError(null)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !boardId) return
    setError(null)
    startTransition(async () => {
      const result = await createTask({ boardId, title, dueDate: due || null, assigneeIds })
      if (result.error) {
        setError(result.error)
        toast(result.error, 'error')
      } else {
        toast('Task added', 'success')
        onOpenChange(false)
      }
    })
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New task" className="max-w-md">
      {boards.length === 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Tasks live on boards. Create a board first, then add tasks to it.</p>
          <div className="flex justify-end">
            <Button asChild><Link href="/tasks">Go to Tasks</Link></Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="qt-title">Title *</Label>
            <Input id="qt-title" className="mt-1" placeholder="Book the rehearsal room" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qt-board">Board</Label>
              <select id="qt-board" className={selectClass} value={boardId} onChange={e => setBoardId(e.target.value)}>
                {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="qt-due">Due date</Label>
              <Input id="qt-due" type="date" className="mt-1" value={due} onChange={e => setDue(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Assign to</Label>
            <div className="mt-1.5"><AssigneePicker members={members} value={assigneeIds} onChange={setAssigneeIds} /></div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={isPending} disabled={!title.trim()}>Add task</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
