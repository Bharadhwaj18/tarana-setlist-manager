'use client'

import { useState, useTransition } from 'react'
import { Plus, ChevronDown, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { createBudget, updateBudget, adjustBudgetAllocation, setBudgetStatus, deleteBudget } from '@/actions/budgets'
import { cn } from '@/lib/utils'
import { todayISO } from '@/lib/shows'
import type { BudgetProgress } from '@/types/budget'

interface Props {
  progress: BudgetProgress[]
  unallocated: number
  isTreasurer: boolean
  memberNames: Record<string, string>
}

const inputCls = 'w-full rounded-md border border-brand-200 bg-white px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function periodLabel(p: BudgetProgress) {
  if (p.budget.recurrence === 'monthly') {
    return `Monthly · ${new Date(p.periodStart + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`
  }
  return p.periodEnd ? `${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}` : `Since ${fmtDate(p.periodStart)}`
}

const barColor = { ok: 'bg-brand-400', warning: 'bg-amber-400', over: 'bg-red-500' } as const

function BudgetForm({ existing, onDone }: { existing?: BudgetProgress; onDone: () => void }) {
  const b = existing?.budget
  const [name, setName] = useState(b?.name ?? '')
  const [amount, setAmount] = useState(b ? String(b.allocated_amount) : '')
  const [recurrence, setRecurrence] = useState<'none' | 'monthly'>(b?.recurrence ?? 'none')
  const [startDate, setStartDate] = useState(b?.start_date ?? todayISO())
  const [endDate, setEndDate] = useState(b?.end_date ?? '')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const base = { name, recurrence, start_date: startDate, end_date: endDate || null }
      const result = b
        ? await updateBudget(b.id, base)
        : await createBudget({ ...base, allocated_amount: parseFloat(amount) })
      if (result.error) toast(result.error, 'error')
      else { toast(b ? 'Budget updated' : 'Budget created', 'success'); onDone() }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Gear upgrades" className={inputCls} required />
      </div>
      {!b && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Allocated (₹) *</label>
          <input type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} className={inputCls} required />
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Repeats</label>
        <div className="flex gap-2">
          {(['none', 'monthly'] as const).map(r => (
            <button key={r} type="button" onClick={() => setRecurrence(r)}
              className={cn('flex-1 rounded-md py-2 text-sm font-semibold transition-colors', recurrence === r ? 'bg-brand-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {r === 'none' ? 'One-off' : 'Every month'}
            </button>
          ))}
        </div>
        {recurrence === 'monthly' && <p className="mt-1 text-xs text-gray-400">Spend is counted for the current calendar month, so the tracker resets each month.</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Starts</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Ends <span className="font-normal text-gray-400">(optional)</span></label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={isPending}>{b ? 'Save' : 'Create'}</Button>
      </div>
    </form>
  )
}

function BudgetCard({ p, isTreasurer, memberNames }: { p: BudgetProgress; isTreasurer: boolean; memberNames: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [delta, setDelta] = useState('')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()
  const b = p.budget
  const closed = b.status === 'closed'

  const run = (fn: () => Promise<{ error?: string }>, ok: string, after?: () => void) =>
    startTransition(async () => {
      const result = await fn()
      if (result.error) toast(result.error, 'error')
      else { toast(ok, 'success'); after?.() }
    })

  const applyDelta = (sign: 1 | -1) => {
    const n = parseFloat(delta)
    if (!n || n <= 0) return
    run(() => adjustBudgetAllocation(b.id, sign * n), sign > 0 ? 'Topped up' : 'Allocation reduced', () => { setDelta(''); setAdjusting(false) })
  }

  const handleDelete = () => {
    if (!window.confirm(`Delete “${b.name}”? Its transactions stay, just untagged.`)) return
    run(() => deleteBudget(b.id), 'Budget deleted')
  }

  return (
    <div className={cn('rounded-lg border p-3.5', closed ? 'border-gray-200 bg-gray-50' : 'border-brand-200 bg-white')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {b.name}{closed && <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">Closed</span>}
          </p>
          <p className="text-xs text-gray-400">{periodLabel(p)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn('text-sm font-bold tabular-nums', p.remaining < 0 ? 'text-red-600' : 'text-gray-900')}>
            {p.remaining < 0 ? '−' : ''}{fmt(p.remaining)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-gray-400">{p.remaining < 0 ? 'Over' : 'Left'}</p>
        </div>
      </div>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={cn('h-full rounded-full', barColor[p.state])} style={{ width: `${Math.min(100, Math.round(p.pct))}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs tabular-nums text-gray-500">
        <span>Spent {fmt(p.spent)}</span>
        <span>Allocated {fmt(b.allocated_amount)}</span>
      </div>

      {p.state === 'over' && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" /> Over budget by {fmt(p.remaining)}
        </p>
      )}
      {p.state === 'warning' && <p className="mt-2 text-xs font-medium text-amber-600">{Math.round(p.pct)}% used</p>}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded} className="flex items-center gap-1 text-xs font-medium text-brand-600">
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
          {p.transactions.length} transaction{p.transactions.length !== 1 ? 's' : ''}
        </button>
        {isTreasurer && (
          <div className="flex items-center gap-3 text-[11px] font-semibold text-brand-600">
            <button type="button" onClick={() => setAdjusting(v => !v)}>Adjust</button>
            <button type="button" onClick={() => setEditing(true)}>Edit</button>
            <button type="button" disabled={isPending} onClick={() => run(() => setBudgetStatus(b.id, closed ? 'active' : 'closed'), closed ? 'Budget reopened' : 'Budget closed')}>
              {closed ? 'Reopen' : 'Close'}
            </button>
            <button type="button" disabled={isPending} onClick={handleDelete} className="text-red-500">Delete</button>
          </div>
        )}
      </div>

      {adjusting && (
        <div className="mt-2.5 flex items-center gap-2">
          <input type="number" min="0" step="any" value={delta} onChange={e => setDelta(e.target.value)} placeholder="₹ amount"
            className="compact-field min-w-0 flex-1 rounded-md border border-brand-200 bg-white px-2 py-1.5 text-[11px]" />
          <Button size="sm" loading={isPending} disabled={!delta} onClick={() => applyDelta(1)}>Top up</Button>
          <Button size="sm" variant="secondary" loading={isPending} disabled={!delta} onClick={() => applyDelta(-1)}>Reduce</Button>
        </div>
      )}

      {expanded && (
        <div className="mt-2.5 space-y-1 border-t border-brand-100 pt-2.5">
          {p.transactions.length === 0 ? (
            <p className="text-xs text-gray-400">Nothing spent this period.</p>
          ) : p.transactions.map(t => (
            <div key={t.id} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-gray-700">
                {t.description} <span className="text-gray-400">· {fmtDate(t.date)}{t.member_id && memberNames[t.member_id] ? ` · ${memberNames[t.member_id]}` : ''}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-gray-800">{fmt(t.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <Modal open={editing} onOpenChange={setEditing} title="Edit Budget">
        <BudgetForm existing={p} onDone={() => setEditing(false)} />
      </Modal>
    </div>
  )
}

export function BudgetsSection({ progress, unallocated, isTreasurer, memberNames }: Props) {
  const [creating, setCreating] = useState(false)
  const active = progress.filter(p => p.budget.status === 'active')
  const closed = progress.filter(p => p.budget.status === 'closed')

  if (progress.length === 0 && !isTreasurer) return null

  return (
    <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Budgets</h2>
          {active.length > 0 && (
            <p className="mt-0.5 text-xs text-gray-500">
              Unallocated: <span className={cn('font-semibold', unallocated < 0 ? 'text-red-600' : 'text-gray-800')}>{unallocated < 0 ? '−' : ''}{fmt(unallocated)}</span>
            </p>
          )}
        </div>
        {isTreasurer && (
          <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Budget
          </Button>
        )}
      </div>

      {progress.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">No budgets yet. Create one to track spending from the band fund.</p>
      ) : (
        <div className="space-y-3">
          {active.map(p => <BudgetCard key={p.budget.id} p={p} isTreasurer={isTreasurer} memberNames={memberNames} />)}
          {closed.length > 0 && (
            <details className="pt-1">
              <summary className="cursor-pointer text-xs font-medium text-gray-400">{closed.length} closed</summary>
              <div className="mt-3 space-y-3">
                {closed.map(p => <BudgetCard key={p.budget.id} p={p} isTreasurer={isTreasurer} memberNames={memberNames} />)}
              </div>
            </details>
          )}
        </div>
      )}

      <Modal open={creating} onOpenChange={setCreating} title="New Budget">
        <BudgetForm onDone={() => setCreating(false)} />
      </Modal>
    </section>
  )
}
