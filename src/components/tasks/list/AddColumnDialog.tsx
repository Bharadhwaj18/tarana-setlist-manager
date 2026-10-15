'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlignLeft, Calendar, CheckSquare2, Hash, ListFilter, Plus, User, X, type LucideIcon } from 'lucide-react'
import { createTaskField, deleteTaskField, updateTaskField } from '@/actions/tasks'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import { TASK_FIELD_TYPES, TASK_FIELD_TYPE_LABELS, fieldOptions, type TaskField, type TaskFieldType } from '@/types/tasks'

const ICONS: Record<TaskFieldType, LucideIcon> = { checkbox: CheckSquare2, select: ListFilter, text: AlignLeft, number: Hash, date: Calendar, person: User }

/** Add a column, or (given `field`) rename it, change its options or remove it. */
export function AddColumnDialog({ open, onOpenChange, field }: { open: boolean; onOpenChange: (v: boolean) => void; field?: TaskField }) {
  const router = useRouter()
  const toast = useToast()
  const [type, setType] = useState<TaskFieldType>((field?.type as TaskFieldType) ?? 'checkbox')
  const [name, setName] = useState(field?.name ?? '')
  const [options, setOptions] = useState<string[]>(field ? fieldOptions(field) : [])
  const [option, setOption] = useState('')
  const [pending, startTransition] = useTransition()

  const addOption = () => {
    const o = option.trim()
    if (o && !options.includes(o)) setOptions([...options, o])
    setOption('')
  }

  const save = () => {
    const allOptions = option.trim() && !options.includes(option.trim()) ? [...options, option.trim()] : options
    startTransition(async () => {
      const res = field
        ? await updateTaskField(field.id, { name, ...(type === 'select' ? { options: allOptions } : {}) })
        : await createTaskField({ name, type, options: allOptions })
      if (res.error) { toast(res.error, 'error'); return }
      toast(field ? 'Column saved' : 'Column added', 'success')
      onOpenChange(false)
      if (!field) { setName(''); setOptions([]); setOption('') }
      router.refresh()
    })
  }

  const remove = () => {
    if (!field || !window.confirm(`Remove the “${field.name}” column? What’s been filled in won’t show any more.`)) return
    startTransition(async () => {
      const res = await deleteTaskField(field.id)
      if (res.error) { toast(res.error, 'error'); return }
      toast('Column removed', 'success')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={field ? `Column: ${field.name}` : 'Add a column'}
      className="max-w-lg max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[88vh] max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-3xl">
      <div className="mt-4 space-y-4">
        {!field && (
          <div className="grid grid-cols-2 gap-2">
            {TASK_FIELD_TYPES.map(t => {
              const Icon = ICONS[t]
              return (
                <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}
                  className={cn('flex min-h-14 items-center gap-2.5 rounded-2xl border-[1.5px] px-3 text-left', type === t ? 'border-brand-400 bg-brand-100' : 'border-brand-200 hover:bg-brand-50')}>
                  <Icon className="h-5 w-5 shrink-0 text-brand-600" />
                  <span>
                    <span className="block text-sm font-extrabold text-gray-900">{TASK_FIELD_TYPE_LABELS[t].label}</span>
                    <span className="block text-[11px] text-gray-500">{TASK_FIELD_TYPE_LABELS[t].hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div>
          <label htmlFor="column-name" className="mb-1.5 block text-xs font-extrabold text-gray-600">Column name</label>
          <Input id="column-name" value={name} maxLength={40} placeholder={type === 'checkbox' ? 'e.g. Advance paid?' : type === 'select' ? 'e.g. Venue type' : 'e.g. Notes for the crew'}
            onChange={e => setName(e.target.value)} className="min-h-12 text-base" />
        </div>

        {type === 'select' && (
          <div>
            <p className="mb-1.5 text-xs font-extrabold text-gray-600">Options</p>
            <div className="flex flex-wrap gap-1.5">
              {options.map(o => (
                <span key={o} className="inline-flex items-center gap-1 rounded-full bg-brand-100 py-1 pl-3 pr-1 text-sm font-bold text-gray-800">
                  {o}
                  <button type="button" aria-label={`Remove ${o}`} onClick={() => setOptions(options.filter(x => x !== o))} className="rounded-full p-0.5 hover:bg-brand-200"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <form className="mt-2 flex gap-2" onSubmit={e => { e.preventDefault(); addOption() }}>
              <Input value={option} maxLength={40} placeholder="Add an option" aria-label="New option" onChange={e => setOption(e.target.value)} className="min-h-11" />
              <button type="submit" disabled={!option.trim()} className="flex min-h-11 items-center gap-1 rounded-xl bg-brand-100 px-3 text-sm font-bold text-gray-800 disabled:opacity-50"><Plus className="h-4 w-4" />Add</button>
            </form>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          {field && <button type="button" onClick={remove} disabled={pending} className="min-h-12 rounded-2xl px-4 text-sm font-bold text-red-700 hover:bg-red-50">Remove column</button>}
          <button type="button" onClick={save} disabled={pending || !name.trim() || (type === 'select' && options.length === 0 && !option.trim())}
            className="min-h-12 flex-1 rounded-2xl bg-brand-400 text-[15px] font-extrabold text-white hover:bg-brand-500 disabled:opacity-50">
            {field ? 'Save column' : 'Add column'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
