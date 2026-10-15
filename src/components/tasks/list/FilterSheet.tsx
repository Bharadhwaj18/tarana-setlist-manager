'use client'

import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { DEFAULT_VIEW, GROUP_BY_LABELS, SHOW_LABELS, SORT_LABELS, type TaskViewState } from '@/lib/task-view'
import type { Member, TaskBoard } from '@/types/tasks'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  view: TaskViewState
  onChange: (v: TaskViewState) => void
  members: Member[]
  boards: TaskBoard[]
  currentUserId?: string
  shownCount: number
}

function Chips<T extends string>({ label, options, isOn, onToggle }: { label: string; options: { value: T; label: string }[]; isOn: (v: T) => boolean; onToggle: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-500">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button key={o.value} type="button" aria-pressed={isOn(o.value)} onClick={() => onToggle(o.value)}
            className={cn('min-h-9 rounded-full px-3.5 text-sm font-bold transition-colors', isOn(o.value) ? 'bg-brand-400 text-white' : 'bg-brand-100 text-gray-800 hover:bg-brand-200')}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

/** Sort, group and every filter in one sheet, so the toolbar itself stays to a search box and one button. */
export function FilterSheet({ open, onOpenChange, view, onChange, members, boards, currentUserId, shownCount }: Props) {
  const set = (patch: Partial<TaskViewState>) => onChange({ ...view, ...patch })
  const others = members.filter(m => m.id !== currentUserId)
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Filter and sort"
      className="max-w-lg max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[85vh] max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-3xl">
      <div className="mt-4 space-y-5">
        <Chips label="Sort by" options={(Object.keys(SORT_LABELS) as TaskViewState['sort'][]).map(v => ({ value: v, label: SORT_LABELS[v] }))}
          isOn={v => view.sort === v} onToggle={v => set({ sort: v })} />
        <Chips label="Group by" options={(Object.keys(GROUP_BY_LABELS) as TaskViewState['groupBy'][]).map(v => ({ value: v, label: GROUP_BY_LABELS[v] }))}
          isOn={v => view.groupBy === v} onToggle={v => set({ groupBy: v })} />
        <Chips label="Who" options={[...(currentUserId ? [{ value: 'me', label: 'Assigned to me' }] : []), ...others.map(m => ({ value: m.id, label: m.name }))]}
          isOn={v => view.who.includes(v)} onToggle={v => set({ who: toggle(view.who, v) })} />
        <Chips label="Show" options={(Object.keys(SHOW_LABELS) as TaskViewState['show'][number][]).map(v => ({ value: v, label: SHOW_LABELS[v] }))}
          isOn={v => view.show.includes(v)} onToggle={v => set({ show: toggle(view.show, v) })} />
        {boards.length > 1 && (
          <Chips label="Group" options={boards.map(b => ({ value: b.id, label: b.name }))}
            isOn={v => view.groups.includes(v)} onToggle={v => set({ groups: toggle(view.groups, v) })} />
        )}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={() => onChange({ ...DEFAULT_VIEW, query: view.query })} className="min-h-12 rounded-2xl px-4 text-sm font-bold text-gray-600 hover:bg-brand-50">Clear all</button>
          <button type="button" onClick={() => onOpenChange(false)} className="min-h-12 flex-1 rounded-2xl bg-brand-400 text-[15px] font-extrabold text-white hover:bg-brand-500">
            Show {shownCount} {shownCount === 1 ? 'task' : 'tasks'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
