'use client'

import { useState, useTransition } from 'react'
import { Tag, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toaster'
import { createLabel, deleteLabel, updateLabel } from '@/actions/tasks'
import { cn } from '@/lib/utils'
import { LABEL_COLORS, labelStyle, type LabelColor, type TaskLabel } from '@/types/tasks'

function ColorDots({ value, onChange }: { value: string; onChange: (c: LabelColor) => void }) {
  return (
    <div className="flex items-center gap-1">
      {LABEL_COLORS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          aria-pressed={value === c}
          className={cn('h-5 w-5 rounded-full border-2', labelStyle(c).dot, value === c ? 'border-gray-900' : 'border-transparent')}
        />
      ))}
    </div>
  )
}

function LabelRow({ boardId, label }: { boardId: string; label: TaskLabel }) {
  const [name, setName] = useState(label.name)
  const [, startTransition] = useTransition()
  const toast = useToast()

  const save = (patch: { name?: string; color?: string }) =>
    startTransition(async () => {
      const result = await updateLabel(boardId, label.id, { name: patch.name ?? name, color: patch.color ?? label.color })
      if (result.error) { toast(result.error, 'error'); setName(label.name) }
    })

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2">
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={() => { if (name.trim() && name.trim() !== label.name) save({ name }); else setName(label.name) }}
        className="h-8 min-w-0 flex-1 py-1"
        aria-label="Label name"
      />
      <ColorDots value={label.color} onChange={c => save({ color: c })} />
      <button
        type="button"
        onClick={() => startTransition(async () => { const r = await deleteLabel(boardId, label.id); if (r.error) toast(r.error, 'error') })}
        className="text-gray-400 hover:text-red-500"
        aria-label={`Delete label ${label.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

export function LabelsManager({ boardId, labels }: { boardId: string; labels: TaskLabel[] }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<LabelColor>('blue')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const add = () => {
    if (!name.trim()) return
    startTransition(async () => {
      const result = await createLabel(boardId, { name, color })
      if (result.error) toast(result.error, 'error')
      else setName('')
    })
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><Tag className="h-4 w-4" /> Labels</Button>
      <Modal open={open} onOpenChange={setOpen} title="Labels" description="Colored tags for this board's tasks." className="max-w-md">
        <div className="space-y-2">
          {labels.map(l => <LabelRow key={l.id} boardId={boardId} label={l} />)}
          {!labels.length && <p className="text-sm text-gray-400">No labels yet.</p>}
        </div>
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
          <Input
            placeholder="New label name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          />
          <div className="flex items-center justify-between gap-2">
            <ColorDots value={color} onChange={setColor} />
            <Button size="sm" onClick={add} loading={isPending} disabled={!name.trim()}>Add label</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
