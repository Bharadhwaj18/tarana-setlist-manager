'use client'

import { useState, useTransition, useMemo } from 'react'
import { Check, RotateCcw, ArrowRight, AlertTriangle } from 'lucide-react'
import { splitShows } from '@/actions/finance'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { ShowExpensePanel } from '@/components/finance/ShowExpensePanel'
import { cn } from '@/lib/utils'
import type { FinanceShow, FinanceShowExpense } from '@/types/finance'

interface Member { id: string; name: string }
interface Props {
  shows: FinanceShow[]
  members: Member[]
  initialExpenses: Record<string, FinanceShowExpense[]>
}

type ShortfallResolution = 'band_fund' | 'pending'

function round2(n: number) { return Math.round(n * 100) / 100 }
function fmt(n: number) { return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` }

export function SplitWizard({ shows, members, initialExpenses }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(shows.map(s => s.id)))
  const [bandPct, setBandPct] = useState(20)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [included, setIncluded] = useState<Set<string>>(new Set(members.map(m => m.id)))
  const [collectedByShow, setCollectedByShow] = useState<Record<string, string>>(
    Object.fromEntries(shows.map(s => [s.id, members[0]?.id ?? '']))
  )
  const [expensesByShow, setExpensesByShow] = useState<Record<string, FinanceShowExpense[]>>(initialExpenses)
  const [shortfallResolutions, setShortfallResolutions] = useState<Record<string, ShortfallResolution>>({})
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const selectedShows = shows.filter(s => selectedIds.has(s.id))

  const netForShow = (show: FinanceShow): number => {
    const expenses = expensesByShow[show.id] ?? []
    return show.gross_income - expenses.reduce((s, e) => s + e.amount, 0)
  }

  const total = useMemo(
    () => selectedShows.reduce((sum, s) => sum + netForShow(s), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedShows, expensesByShow]
  )

  const bandAmount = round2(total * bandPct / 100)
  const memberPool = round2(total - bandAmount)
  const includedMembers = members.filter(m => included.has(m.id))
  const basePerMember = includedMembers.length > 0 ? round2(memberPool / includedMembers.length) : 0

  const memberAmounts = members.map(m => {
    if (!included.has(m.id)) return { ...m, amount: 0, excluded: true }
    const raw = overrides[m.id]
    const amount = raw !== undefined && raw !== '' ? (parseFloat(raw) || 0) : basePerMember
    return { ...m, amount, excluded: false }
  })

  const allocatedTotal = round2(memberAmounts.reduce((s, m) => s + m.amount, 0))
  const remaining = round2(memberPool - allocatedTotal)
  const isBalanced = Math.abs(remaining) < 0.5

  const resetToEqual = () => setOverrides({})
  const toggleMember = (id: string) => {
    setIncluded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setOverrides({})
  }
  const toggleShow = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setOverrides({})
  }
  const handleBandPct = (v: number) => { setBandPct(v); setOverrides({}) }
  const handleExpensesChange = (showId: string, expenses: FinanceShowExpense[]) => {
    setExpensesByShow(prev => ({ ...prev, [showId]: expenses }))
    setOverrides({})
  }

  // Per-show cash settlements
  const showSettlements = useMemo(() => {
    if (total === 0) return []
    return selectedShows.map(show => {
      const showNet = netForShow(show)
      const collectorId = collectedByShow[show.id] ?? members[0]?.id
      const collector = members.find(m => m.id === collectorId)
      if (!collector) return null

      const ratio = total > 0 ? showNet / total : 0
      const payments: { to: string; toId: string; amount: number }[] = []

      for (const m of memberAmounts) {
        if (m.id === collectorId || m.excluded || m.amount <= 0) continue
        const share = round2(m.amount * ratio)
        if (share > 0) payments.push({ to: m.name, toId: m.id, amount: share })
      }

      const bandFromShow = round2(bandAmount * ratio)
      const ownShare = round2((memberAmounts.find(m => m.id === collectorId)?.amount ?? 0) * ratio)
      const keeps = round2(ownShare + bandFromShow)

      // Cash position: collector has gross_income minus expenses they personally paid
      const collectorExpenses = (expensesByShow[show.id] ?? [])
        .filter(e => e.paid_by === collectorId)
        .reduce((s, e) => s + e.amount, 0)
      const availableCash = show.gross_income - collectorExpenses
      const totalToPayOut = payments.reduce((s, p) => s + p.amount, 0) + bandFromShow
      const shortfall = round2(Math.max(0, totalToPayOut - availableCash))

      return { show, showNet, collector, payments, keeps, availableCash, shortfall, bandFromShow }
    }).filter(Boolean) as {
      show: FinanceShow
      showNet: number
      collector: Member
      payments: { to: string; toId: string; amount: number }[]
      keeps: number
      availableCash: number
      shortfall: number
      bandFromShow: number
    }[]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShows, collectedByShow, memberAmounts, bandAmount, total, expensesByShow, members])

  const showLabel = selectedIds.size === 1
    ? (shows.find(s => selectedIds.has(s.id))?.title ?? 'Show')
    : `${selectedIds.size} shows`

  const handleSplit = () => {
    if (selectedIds.size === 0) return
    const shares = memberAmounts.filter(m => !m.excluded && m.amount > 0).map(m => ({
      memberId: m.id,
      amount: m.amount,
      description: `Show split — ${showLabel}`,
    }))

    // Build adjustments for shortfall resolutions
    const adjustments: { fromMemberId: string | null; toMemberId: string | null; amount: number; description: string }[] = []
    for (const s of showSettlements) {
      if (s.shortfall <= 0) continue
      const resolution = shortfallResolutions[s.show.id] ?? 'band_fund'
      if (resolution === 'band_fund') {
        adjustments.push({
          fromMemberId: null,
          toMemberId: s.collector.id,
          amount: s.shortfall,
          description: `Band fund cover shortfall — ${s.show.title}`,
        })
      }
      // 'pending' = no transaction
    }

    startTransition(async () => {
      const result = await splitShows([...selectedIds], bandPct, shares, adjustments.length ? adjustments : undefined)
      if (result && 'error' in result && result.error) toast(result.error, 'error')
    })
  }

  const selectCls = 'rounded-md border border-brand-200 bg-white px-2 py-1 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'
  const inputCls = 'w-28 rounded-md border border-brand-200 bg-white px-3 py-1.5 text-right text-sm tabular-nums focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

  return (
    <div className="space-y-6">
      {/* Show selection with expenses */}
      <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Select shows & expenses</h2>
        <div className="space-y-2">
          {shows.map(s => {
            const selected = selectedIds.has(s.id)
            const showNet = netForShow(s)
            return (
              <div key={s.id} className={cn('rounded-lg border transition-colors', selected ? 'border-brand-400 bg-brand-50' : 'border-brand-200')}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button type="button" onClick={() => toggleShow(s.id)}
                    className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                      selected ? 'border-brand-400 bg-brand-400' : 'border-gray-300 hover:border-gray-400')}>
                    {selected && <Check className="h-3 w-3 text-white" />}
                  </button>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{s.title}</p>
                    {s.show_date && <p className="text-xs text-gray-400">
                      {new Date(s.show_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                      {s.venue ? ` · ${s.venue}` : ''}
                    </p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-700">{fmt(s.gross_income)}</p>
                    {showNet < s.gross_income && (
                      <p className="text-xs text-brand-600">net {fmt(showNet)}</p>
                    )}
                  </div>
                </div>

                {/* Show expenses panel */}
                {selected && (
                  <>
                    <ShowExpensePanel
                      showId={s.id}
                      grossIncome={s.gross_income}
                      initialExpenses={expensesByShow[s.id] ?? []}
                      members={members}
                      onExpensesChange={handleExpensesChange}
                    />
                    <div className="flex items-center gap-2 border-t border-brand-100 px-4 py-2">
                      <span className="text-xs text-gray-500">Collected by</span>
                      <select
                        value={collectedByShow[s.id] ?? members[0]?.id}
                        onChange={e => setCollectedByShow(prev => ({ ...prev, [s.id]: e.target.value }))}
                        className={selectCls}
                        onClick={e => e.stopPropagation()}
                      >
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-brand-50 px-4 py-2.5">
          <span className="text-sm font-medium text-gray-600">Total net</span>
          <span className="text-lg font-bold text-gray-900">{fmt(total)}</span>
        </div>
      </section>

      {/* Band fund slider */}
      <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Band fund cut</h2>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-gray-500">Band fund <span className="font-bold text-brand-600">{bandPct}%</span> = {fmt(bandAmount)}</span>
          <span className="text-gray-500">Members <span className="font-bold text-green-600">{100 - bandPct}%</span> = {fmt(memberPool)}</span>
        </div>
        <input type="range" min={0} max={50} step={5} value={bandPct}
          onChange={e => handleBandPct(Number(e.target.value))}
          className="w-full cursor-pointer accent-brand-400" />
        <div className="mt-1 flex justify-between text-xs text-gray-400"><span>0%</span><span>50%</span></div>
        {bandAmount > 0 && (
          <p className="mt-3 text-xs text-gray-400">Band fund stays with whoever collected the show money.</p>
        )}
      </section>

      {/* Member shares */}
      <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Member shares <span className="ml-1 text-xs font-normal text-gray-400">(default: equal)</span>
          </h2>
          {Object.keys(overrides).length > 0 && (
            <button onClick={resetToEqual} className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700">
              <RotateCcw className="h-3 w-3" /> Reset equal
            </button>
          )}
        </div>
        <div className="space-y-3">
          {memberAmounts.map(m => {
            const isOverridden = !m.excluded && overrides[m.id] !== undefined && overrides[m.id] !== ''
            return (
              <div key={m.id} className={cn('flex items-center gap-3 transition-opacity', m.excluded && 'opacity-40')}>
                <button type="button" onClick={() => toggleMember(m.id)}
                  className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                    !m.excluded ? 'border-brand-400 bg-brand-400' : 'border-gray-300 hover:border-gray-400')}
                  title={m.excluded ? 'Include' : 'Exclude'}>
                  {!m.excluded && <Check className="h-3 w-3 text-white" />}
                </button>
                <span className={cn('flex-1 text-sm font-medium', m.excluded ? 'text-gray-400 line-through' : 'text-gray-700')}>
                  {m.name}
                </span>
                {!m.excluded ? (
                  <>
                    {isOverridden && <span className="text-xs text-gray-400 line-through">{fmt(basePerMember)}</span>}
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-400">₹</span>
                      <input type="number" min="0" step="any"
                        value={overrides[m.id] ?? String(basePerMember)}
                        onChange={e => setOverrides(prev => ({ ...prev, [m.id]: e.target.value }))}
                        className={cn(inputCls, isOverridden && 'border-brand-400')} />
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-gray-400">not in this show</span>
                )}
              </div>
            )
          })}
          {bandAmount > 0 && (
            <div className="flex items-center gap-3 border-t border-brand-100 pt-3">
              <span className="flex-1 text-sm font-medium text-brand-500">Band Fund (stays with collector)</span>
              <span className="text-sm font-bold text-brand-700">{fmt(bandAmount)}</span>
            </div>
          )}
        </div>
        <div className={cn('mt-4 flex items-center justify-between rounded-lg px-4 py-2 text-sm',
          isBalanced ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
          <span>{isBalanced ? 'Fully allocated ✓' : remaining > 0 ? `${fmt(remaining)} unallocated` : `${fmt(Math.abs(remaining))} over-allocated`}</span>
          <span className="font-semibold">{fmt(allocatedTotal)} / {fmt(memberPool)}</span>
        </div>
      </section>

      {/* Per-show cash settlements */}
      {showSettlements.some(s => s.payments.length > 0 || s.shortfall > 0) && (
        <section className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-600">Cash settlements</h2>
          <div className="space-y-5">
            {showSettlements.map(({ show, showNet, collector, payments, keeps, availableCash, shortfall, bandFromShow }) => (
              <div key={show.id}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {show.title} · net {fmt(showNet)} · collected by {collector.name}
                </p>

                {/* Available cash vs what they need to distribute */}
                <div className="mb-2 flex items-center justify-between rounded-lg bg-white px-4 py-2 shadow-sm text-sm">
                  <span className="text-gray-500">{collector.name} available cash</span>
                  <span className={cn('font-semibold', availableCash < (payments.reduce((s,p)=>s+p.amount,0) + bandFromShow) ? 'text-amber-600' : 'text-gray-700')}>
                    {fmt(availableCash)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {payments.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 shadow-sm">
                      <span className="text-xs text-gray-500">{collector.name}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-gray-300" />
                      <span className="text-sm font-medium text-gray-700">{p.to}</span>
                      <span className="ml-auto text-sm font-bold text-gray-900">{fmt(p.amount)}</span>
                    </div>
                  ))}
                  {keeps > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-2">
                      <span className="text-sm text-brand-700">{collector.name} keeps</span>
                      <span className="text-sm font-bold text-brand-900">{fmt(keeps)}</span>
                    </div>
                  )}
                </div>

                {/* Shortfall resolver */}
                {shortfall > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <p className="text-sm font-semibold text-amber-800">
                        {collector.name} is short {fmt(shortfall)} — how will this be covered?
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShortfallResolutions(prev => ({ ...prev, [show.id]: 'band_fund' }))}
                        className={cn(
                          'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                          (shortfallResolutions[show.id] ?? 'band_fund') === 'band_fund'
                            ? 'bg-amber-600 text-white'
                            : 'bg-white text-amber-700 hover:bg-amber-100'
                        )}
                      >
                        Band fund covers it
                      </button>
                      <button
                        onClick={() => setShortfallResolutions(prev => ({ ...prev, [show.id]: 'pending' }))}
                        className={cn(
                          'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                          shortfallResolutions[show.id] === 'pending'
                            ? 'bg-gray-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                        )}
                      >
                        Mark as pending
                      </button>
                    </div>
                    {(shortfallResolutions[show.id] ?? 'band_fund') === 'band_fund' && (
                      <p className="mt-1.5 text-xs text-amber-600">
                        Band fund will lend {fmt(shortfall)} to {collector.name} — recorded as debit on band fund.
                      </p>
                    )}
                    {shortfallResolutions[show.id] === 'pending' && (
                      <p className="mt-1.5 text-xs text-gray-500">
                        No transaction recorded. You can settle this manually later.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Confirm */}
      <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-green-800">
            {fmt(allocatedTotal)} to members{bandAmount > 0 ? `, ${fmt(bandAmount)} band fund kept by collectors` : ''}
          </p>
          <p className="text-xs text-green-600">from {selectedIds.size} show{selectedIds.size !== 1 ? 's' : ''} · net {fmt(total)}</p>
        </div>
        <Button onClick={handleSplit} loading={isPending} disabled={selectedIds.size === 0 || total === 0}>
          Confirm & Split →
        </Button>
      </div>
    </div>
  )
}
