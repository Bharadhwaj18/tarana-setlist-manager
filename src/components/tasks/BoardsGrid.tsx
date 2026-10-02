'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, SquareKanban } from 'lucide-react'
import { createBoard } from '@/actions/tasks'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toaster'

export interface BoardSummary {
  id: string
  name: string
  open: number
  done: number
  overdue: number
  bucketNames: string[]
}

export function NewBoardForm({ autoOpen = false }: { autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen)
  const [name, setName] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    startTransition(async () => {
      const result = await createBoard(name)
      if (result.error || !result.id) { toast(result.error ?? 'Could not create the board', 'error'); return }
      router.push(`/tasks/${result.id}`)
    })
  }

  if (!open) return <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New board</Button>
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Input autoFocus placeholder="Board name, e.g. Album release" value={name} onChange={e => setName(e.target.value)} className="w-64" />
      <Button type="submit" loading={isPending} disabled={!name.trim()}>Create</Button>
      <Button type="button" variant="ghost" onClick={() => { setName(''); setOpen(false) }}>Cancel</Button>
    </form>
  )
}

export function BoardsGrid({ boards }: { boards: BoardSummary[] }) {
  if (!boards.length) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
        <SquareKanban className="h-12 w-12 text-gray-300" />
        <div>
          <p className="font-medium text-gray-500">No boards yet</p>
          <p className="text-sm text-gray-400">A board is a project: buckets like To do, In progress and Done, with tasks you can assign and drag between them</p>
        </div>
        <NewBoardForm />
      </div>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {boards.map(b => (
        <Link key={b.id} href={`/tasks/${b.id}`} className="group rounded-xl border border-brand-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-center gap-2">
            <SquareKanban className="h-4 w-4 shrink-0 text-brand-500" />
            <h2 className="truncate font-semibold text-gray-900 group-hover:text-brand-600">{b.name}</h2>
          </div>
          <p className="mt-1 truncate text-xs text-gray-400">{b.bucketNames.join(' · ')}</p>
          <div className="mt-4 flex items-center gap-3 text-sm">
            <span className="text-gray-700"><strong className="font-semibold">{b.open}</strong> open</span>
            <span className="text-gray-400">{b.done} done</span>
            {b.overdue > 0 && <span className="ml-auto rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-600">{b.overdue} overdue</span>}
          </div>
        </Link>
      ))}
    </div>
  )
}
