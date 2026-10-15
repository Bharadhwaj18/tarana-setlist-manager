'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckSquare2, Plus, Square, Trash2, X } from 'lucide-react'
import { deleteTask } from '@/actions/tasks'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import type { Task } from '@/types/tasks'
import type { CellContext } from './cells'

/** Notes, checklist and delete, opened right under the task's row instead of in a pop-up. */
export function TaskExtras({ task, c }: { task: Task; c: CellContext }) {
  const router = useRouter()
  const toast = useToast()
  const [notes, setNotes] = useState(task.description ?? '')
  const [newItem, setNewItem] = useState('')
  const [pending, startTransition] = useTransition()
  const checklist = task.checklist
  const done = checklist.filter(i => i.done).length

  const saveChecklist = (list: typeof checklist) => c.onPatch(task, { checklist: list })

  const remove = (e: React.MouseEvent<HTMLElement>) => {
    if (!window.confirm(`Delete “${task.title}”? This can’t be undone.`)) return
    // The row eases out first, then the delete runs and the list refreshes without it.
    const row = e.currentTarget.closest('[data-task-row]')
    row?.classList.add('animate-row-out')
    window.setTimeout(() => startTransition(async () => {
      const res = await deleteTask(task.id)
      if (res.error) { toast(res.error, 'error'); row?.classList.remove('animate-row-out'); return }
      toast('Task deleted', 'success')
      router.refresh()
    }), 200)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2" onClick={e => e.stopPropagation()}>
      <div>
        <label htmlFor={`notes-${task.id}`} className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.1em] text-gray-500">Notes</label>
        <textarea id={`notes-${task.id}`} value={notes} readOnly={c.readOnly} rows={4} placeholder="Anything worth remembering about this task"
          onChange={e => setNotes(e.target.value)}
          onBlur={() => { if (notes !== (task.description ?? '')) c.onPatch(task, { description: notes }) }}
          className="w-full resize-y rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400" />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-gray-500">Checklist{checklist.length > 0 && ` · ${done} of ${checklist.length}`}</p>
        <ul className="space-y-0.5">
          {checklist.map(item => (
            <li key={item.id} className="group flex items-center gap-2">
              <button type="button" disabled={c.readOnly} aria-pressed={item.done} aria-label={`${item.text}: ${item.done ? 'done' : 'not done'}`}
                onClick={() => saveChecklist(checklist.map(i => (i.id === item.id ? { ...i, done: !i.done } : i)))}
                className={cn('flex h-8 w-8 shrink-0 items-center justify-center', item.done ? 'text-emerald-600' : 'text-gray-400')}>
                {item.done ? <CheckSquare2 className="h-[18px] w-[18px]" /> : <Square className="h-[18px] w-[18px]" />}
              </button>
              <span className={cn('min-w-0 flex-1 text-sm', item.done && 'text-gray-400 line-through')}>{item.text}</span>
              {!c.readOnly && (
                <button type="button" aria-label={`Remove ${item.text}`} onClick={() => saveChecklist(checklist.filter(i => i.id !== item.id))}
                  className="rounded p-1 text-gray-300 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {!c.readOnly && (
          <form className="mt-1 flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (newItem.trim()) { saveChecklist([...checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }]); setNewItem('') } }}>
            <Plus className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
            <input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="Add an item" aria-label="New checklist item"
              className="min-h-9 flex-1 rounded-lg bg-transparent px-1 text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-400" />
          </form>
        )}
        {!c.readOnly && (
          <button type="button" onClick={remove} disabled={pending} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" /> Delete task
          </button>
        )}
      </div>
    </div>
  )
}
