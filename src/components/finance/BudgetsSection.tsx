'use client'

import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { useState, useTransition } from 'react'
import { Plus, ChevronDown, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { useToast } from '@/components/ui/Toaster'
import { createBudget, updateBudget, adjustBudgetAllocation, setBudgetStatus, deleteBudget } from '@/actions/budgets'
import { cn } from '@/lib/utils'
import { todayISO } from '@/lib/shows'
import { BAR_FILL } from './money'
import type { BudgetProgress } from '@/types/budget'

interface Props {
  progress: BudgetProgress[]
  unallocated: number
  isTreasurer: boolean
  memberNames: Record<string, string>
}

const inputCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function periodLabel(p: BudgetProgress) {
  if (p.budget.recurrence === 'monthly') {
    return `Monthly · ${new Date(p.periodStart + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`
  }
  return p.periodEnd ? `${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}` : `Since ${fmtDate(p.periodStart)}`
}

const barColor = { ok: BAR_FILL, warning: 'bg-amber-400', over: 'bg-red-500' } as const

function BudgetForm({ existing, onDone }: { existing?: BudgetProgress; onDone: () => void }) {
  const { symbol } = useMoney()
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
          <label className="mb-1 block text-sm font-medium text-gray-700">Allocated ({symbol}) *</label>
          <input type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} className={inputCls} required />
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Repeats</label>
        <div className="flex rounded-xl bg-brand-100 p-1">
          {(['none', 'monthly'] as const).map(r => (
            <button key={r} type="button" onClick={() => setRecurrence(r)}
              className={cn('flex-1 rounded-lg py-2 text-sm font-bold transition-colors', recurrence === r ? 'bg-brand-400 text-white shadow-sm' : 'text-gray-700 hover:text-gray-900')}>
              {r === 'none' ? 'One-off' : 'Every month'}
            </button>
          ))}
        </div>
        {recurrence === 'monthly' && <p className="mt-1 text-xs text-gray-500">Spend is counted for the current calendar month, so the tracker resets each month.</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Starts</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Ends <span className="font-normal text-gray-500">(optional)</span></label>
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
  const { money: fmt, symbol } = useMoney()
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
    <div className={cn('py-3.5 first:pt-0 last:pb-0', closed && 'opacity-70')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-gray-900">
            {b.name}{closed && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">Closed</span>}
          </p>
          <p className="text-xs text-gray-500">{periodLabel(p)}</p>
        </div>
        <p className={cn('shrink-0 text-right text-sm tabular-nums', p.state === 'over' ? 'font-extrabold text-red-700' : p.state === 'warning' ? 'font-bold text-amber-700' : 'text-gray-500')}>
          {fmt(p.spent)} of {fmt(b.allocated_amount)}
        </p>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={cn('animate-bar-grow h-full rounded-full', barColor[p.state])} style={{ width: `${Math.min(100, Math.round(p.pct))}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs tabular-nums text-gray-500">
        <span>{p.remaining < 0 ? 'Over' : 'Left'} <span className={cn('font-semibold', p.remaining < 0 ? 'text-red-700' : 'text-gray-800')}>{p.remaining < 0 ? '−' : ''}{fmt(p.remaining)}</span></span>
        {p.state === 'warning' && <span className="font-semibold text-amber-700">{Math.round(p.pct)}% used</span>}
      </div>

      {p.state === 'over' && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-700">
          <AlertTriangle className="h-3.5 w-3.5" /> Over budget by {fmt(p.remaining)}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded} className="flex items-center gap-1 text-xs font-bold text-brand-400 dark:text-emerald-400">
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
          {p.transactions.length} transaction{p.transactions.length !== 1 ? 's' : ''}
        </button>
        {isTreasurer && (
          <div className="flex items-center gap-3 text-[11px] font-bold text-brand-400 dark:text-emerald-400">
            <button type="button" onClick={() => setAdjusting(v => !v)}>Adjust</button>
            <button type="button" onClick={() => setEditing(true)}>Edit</button>
            <button type="button" disabled={isPending} onClick={() => run(() => setBudgetStatus(b.id, closed ? 'active' : 'closed'), closed ? 'Budget reopened' : 'Budget closed')}>
              {closed ? 'Reopen' : 'Close'}
            </button>
            <button type="button" disabled={isPending} onClick={handleDelete} className="text-red-700">Delete</button>
          </div>
        )}
      </div>

      {adjusting && (
        <div className="mt-2.5 flex items-center gap-2">
          <input type="number" min="0" step="any" value={delta} onChange={e => setDelta(e.target.value)} placeholder={`${symbol} amount`}
            className="compact-field min-w-0 flex-1 rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-[11px]" />
          <Button size="sm" loading={isPending} disabled={!delta} onClick={() => applyDelta(1)}>Top up</Button>
          <Button size="sm" variant="secondary" loading={isPending} disabled={!delta} onClick={() => applyDelta(-1)}>Reduce</Button>
        </div>
      )}

      {expanded && (
        <div className="mt-2.5 space-y-1 border-t border-brand-100 pt-2.5">
          {p.transactions.length === 0 ? (
            <p className="text-xs text-gray-500">Nothing spent this period.</p>
          ) : p.transactions.map(t => (
            <div key={t.id} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-gray-700">
                {t.description} <span className="text-gray-500">· {fmtDate(t.date)}{t.member_id && memberNames[t.member_id] ? ` · ${memberNames[t.member_id]}` : ''}</span>
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
  const { money: fmt, settings: moneySettings } = useMoney()
  const [creating, setCreating] = useState(false)
  const active = progress.filter(p => p.budget.status === 'active')
  const closed = progress.filter(p => p.budget.status === 'closed')

  if (progress.length === 0 && !isTreasurer) return null

  return (
    <section className="flex flex-col rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionLabel>Budgets</SectionLabel>
        {isTreasurer && (
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1 text-xs font-extrabold text-brand-400 hover:underline dark:text-emerald-400">
            <Plus className="h-3.5 w-3.5" /> New budget
          </button>
        )}
      </div>

      {progress.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">No budgets yet. Create one to track spending from the {moneySettings.fundName}.</p>
      ) : (
        <div className="divide-y divide-brand-100">
          {active.map(p => <BudgetCard key={p.budget.id} p={p} isTreasurer={isTreasurer} memberNames={memberNames} />)}
          {closed.length > 0 && (
            <details className="pt-3">
              <summary className="cursor-pointer text-xs font-bold text-gray-500">{closed.length} closed</summary>
              <div className="mt-3 divide-y divide-brand-100">
                {closed.map(p => <BudgetCard key={p.budget.id} p={p} isTreasurer={isTreasurer} memberNames={memberNames} />)}
              </div>
            </details>
          )}
        </div>
      )}

      {active.length > 0 && (
        <div className="mt-auto flex items-center justify-between border-t border-brand-100 pt-3 text-sm">
          <span className="text-gray-500">Unallocated fund</span>
          <b className={cn('tabular-nums', unallocated < 0 ? 'text-red-700' : 'text-gray-900')}>{unallocated < 0 ? '−' : ''}{fmt(unallocated)}</b>
        </div>
      )}

      <Modal open={creating} onOpenChange={setCreating} title="New Budget">
        <BudgetForm onDone={() => setCreating(false)} />
      </Modal>
    </section>
  )
}
