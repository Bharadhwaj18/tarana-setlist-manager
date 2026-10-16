'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pause, Pencil, Play, Plus, Repeat, Trash2 } from 'lucide-react'
import { createRecurring, deleteRecurring, setRecurringPaused, updateRecurring } from '@/actions/finance-settings'
import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { activeCategories, categoryLabel, REIMBURSEMENT_KEY } from '@/lib/finance/settings'
import { FREQUENCY_LABELS, nextOccurrence, type RecurringFrequency } from '@/lib/finance/recurring'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusPill } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import type { FinanceProject, FinanceRecurring } from '@/types/finance'
import { Select } from '@/components/ui/Select'

interface Member { id: string; name: string }

const label = 'mb-1.5 block text-sm font-bold text-gray-800'
const select = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

function shortDate(iso: string) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'))
}

function RecurringForm({ existing, open, onOpenChange, members, projects, today }: {
  existing?: FinanceRecurring; open: boolean; onOpenChange: (v: boolean) => void; members: Member[]; projects: FinanceProject[]; today: string
}) {
  const router = useRouter()
  const toast = useToast()
  const { settings, symbol } = useMoney()
  const [dir, setDir] = useState<'in' | 'out'>(existing && existing.amount > 0 ? 'in' : 'out')
  const [amount, setAmount] = useState(existing ? String(Math.abs(existing.amount)) : '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [category, setCategory] = useState(existing?.category ?? activeCategories(settings, 'out').find(c => c.key !== REIMBURSEMENT_KEY)?.key ?? 'misc')
  const [memberId, setMemberId] = useState(existing?.member_id ?? '')
  const [projectId, setProjectId] = useState(existing?.project_id ?? '')
  const [frequency, setFrequency] = useState<RecurringFrequency>((existing?.frequency as RecurringFrequency) ?? 'monthly')
  const [start, setStart] = useState(existing?.start_date ?? today)
  const [end, setEnd] = useState(existing?.end_date ?? '')
  const [pending, startTransition] = useTransition()

  const categories = activeCategories(settings, dir).filter(c => c.key !== REIMBURSEMENT_KEY)
  const projectOptions = settings.features.projects ? projects.filter(p => !p.archived_at || p.id === existing?.project_id) : []

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = Number(amount)
    if (!value || value <= 0) { toast('Enter an amount.', 'error'); return }
    const input = {
      description, amount: dir === 'in' ? value : -value, category, member_id: memberId || null, project_id: projectId || null,
      frequency, start_date: start, end_date: end || null,
    }
    startTransition(async () => {
      const res = existing ? await updateRecurring(existing.id, input) : await createRecurring(input)
      if (res.error) { toast(res.error, 'error'); return }
      toast(existing ? 'Saved' : 'Repeating entry added', 'success')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={existing ? 'Edit repeating entry' : 'New repeating entry'}
      description="Added to Finance automatically on each date, so you don’t have to remember." className="max-w-[480px] rounded-2xl">
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="flex rounded-xl bg-brand-100 p-1">
          {(['in', 'out'] as const).map(d => (
            <button key={d} type="button" onClick={() => { setDir(d); setCategory(activeCategories(settings, d).find(c => c.key !== REIMBURSEMENT_KEY)?.key ?? 'misc') }}
              className={cn('flex-1 rounded-lg px-2 py-2 text-sm font-bold', dir === d ? 'bg-brand-400 text-white shadow-sm' : 'text-gray-700')}>
              {d === 'in' ? 'Money in' : 'Money out'}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="rec-desc" className={label}>What is it?</label>
          <Input id="rec-desc" value={description} maxLength={200} required placeholder={dir === 'in' ? 'e.g. Monthly residency fee' : 'e.g. Rehearsal studio rent'} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rec-amount" className={label}>Amount</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">{symbol}</span>
              <Input id="rec-amount" type="number" min={0} step="any" required value={amount} className="pl-8" onChange={e => setAmount(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="rec-freq" className={label}>How often</label>
            <Select id="rec-freq" className={select} value={frequency} onChange={e => setFrequency(e.target.value as RecurringFrequency)}>
              {(Object.keys(FREQUENCY_LABELS) as RecurringFrequency[]).map(f => <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>)}
            </Select>
          </div>
        </div>
        <div>
          <p className={label}>Category</p>
          <div className="flex flex-wrap gap-1.5">
            {categories.map(c => <Chip key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>{c.label}</Chip>)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rec-start" className={label}>First date</label>
            <Input id="rec-start" type="date" required value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div>
            <label htmlFor="rec-end" className={label}>Last date <span className="font-normal text-gray-500">(optional)</span></label>
            <Input id="rec-end" type="date" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
        </div>
        <div className={cn('grid gap-3', projectOptions.length > 0 && 'grid-cols-2')}>
          <div>
            <label htmlFor="rec-member" className={label}>{dir === 'in' ? 'Received by' : 'Paid by'}</label>
            <Select id="rec-member" className={select} value={memberId} onChange={e => setMemberId(e.target.value)}>
              <option value="">Whoever set it up</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </div>
          {projectOptions.length > 0 && (
            <div>
              <label htmlFor="rec-project" className={label}>Project</label>
              <Select id="rec-project" className={select} value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">No project</option>
                {projectOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
          )}
        </div>
        {start < today && !existing && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">The first date is in the past, so entries for the dates already gone will be added straight away.</p>
        )}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={pending} disabled={!description.trim() || !amount}>{existing ? 'Save' : 'Add'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function RuleRow({ rule, members, projects, today, canEdit }: { rule: FinanceRecurring; members: Member[]; projects: FinanceProject[]; today: string; canEdit: boolean }) {
  const { money, settings } = useMoney()
  const router = useRouter()
  const toast = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const next = rule.paused ? null : nextOccurrence({ frequency: rule.frequency as RecurringFrequency, start_date: rule.start_date, end_date: rule.end_date }, today)
  const isIn = rule.amount > 0
  const who = members.find(m => m.id === rule.member_id)?.name

  const run = (fn: () => Promise<{ error?: string }>, done: string) =>
    startTransition(async () => {
      const res = await fn()
      if (res.error) { toast(res.error, 'error'); return }
      toast(done, 'success')
      router.refresh()
    })

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-bold text-gray-900">
          {rule.description}
          {rule.paused && <StatusPill tone="gray">Paused</StatusPill>}
          {!rule.paused && !next && <StatusPill tone="gray">Ended</StatusPill>}
        </p>
        <p className="text-xs text-gray-500">
          {FREQUENCY_LABELS[rule.frequency as RecurringFrequency]} · {categoryLabel(settings, rule.category)}{who ? ` · ${who}` : ''}
          {next && ` · next ${shortDate(next)}`}
        </p>
      </div>
      <span className={cn('text-sm font-extrabold tabular-nums', isIn ? 'text-brand-600 dark:text-emerald-400' : 'text-red-700')}>{isIn ? '+' : '−'}{money(rule.amount)}</span>
      {canEdit && (
        <div className="flex gap-1">
          <button type="button" aria-label="Edit" onClick={() => setEditOpen(true)} className="rounded-md p-1.5 text-gray-500 hover:bg-brand-100"><Pencil className="h-4 w-4" /></button>
          <button type="button" aria-label={rule.paused ? 'Resume' : 'Pause'} title={rule.paused ? 'Resume' : 'Pause'} disabled={pending}
            onClick={() => run(() => setRecurringPaused(rule.id, !rule.paused), rule.paused ? 'Resumed' : 'Paused')}
            className="rounded-md p-1.5 text-gray-500 hover:bg-brand-100">{rule.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>
          <button type="button" aria-label="Stop and delete" disabled={pending}
            onClick={() => { if (window.confirm(`Stop “${rule.description}”? Entries it already added stay in the history.`)) run(() => deleteRecurring(rule.id), 'Stopped') }}
            className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
        </div>
      )}
      <RecurringForm existing={rule} open={editOpen} onOpenChange={setEditOpen} members={members} projects={projects} today={today} />
    </li>
  )
}

export function RecurringManager({ rules, members, projects, today, canEdit }: { rules: FinanceRecurring[]; members: Member[]; projects: FinanceProject[]; today: string; canEdit: boolean }) {
  const [newOpen, setNewOpen] = useState(false)
  return (
    <div className="space-y-4">
      {canEdit && rules.length > 0 && (
        <div className="flex justify-end"><Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New repeating entry</Button></div>
      )}
      {rules.length === 0 ? (
        <EmptyState icon={<Repeat className="h-8 w-8" />} title="Nothing repeats yet"
          description="Rent, a monthly retainer, a subscription: add it once and it shows up on every date by itself."
          action={canEdit ? <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New repeating entry</Button> : undefined} />
      ) : (
        <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-200 bg-white">
          {rules.map(r => <RuleRow key={r.id} rule={r} members={members} projects={projects} today={today} canEdit={canEdit} />)}
        </ul>
      )}
      <RecurringForm open={newOpen} onOpenChange={setNewOpen} members={members} projects={projects} today={today} />
    </div>
  )
}
