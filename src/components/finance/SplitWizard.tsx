'use client'

import { useState, useTransition, useMemo } from 'react'
import { Check, RotateCcw, ArrowRight } from 'lucide-react'
import { splitShows } from '@/actions/finance'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import type { FinanceShow } from '@/types/finance'

interface Member { id: string; name: string }
interface Props { shows: FinanceShow[]; members: Member[] }

function round2(n: number) { return Math.round(n * 100) / 100 }
function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` }

export function SplitWizard({ shows, members }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(shows.map(s => s.id)))
  const [bandPct, setBandPct] = useState(20)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [included, setIncluded] = useState<Set<string>>(new Set(members.map(m => m.id)))
  // Per-show collector: show_id → member_id
  const [collectedByShow, setCollectedByShow] = useState<Record<string, string>>(
    Object.fromEntries(shows.map(s => [s.id, members[0]?.id ?? '']))
  )
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const selectedShows = shows.filter(s => selectedIds.has(s.id))
  const total = useMemo(() => selectedShows.reduce((sum, s) => sum + s.gross_income, 0), [selectedShows])

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

  // Per-show "who pays who" — grouped by collector
  const showSettlements = useMemo(() => {
    if (total === 0) return []
    return selectedShows.map(show => {
      const collectorId = collectedByShow[show.id] ?? members[0]?.id
      const collector = members.find(m => m.id === collectorId)
      if (!collector) return null

      const ratio = show.gross_income / total
      const payments: { to: string; amount: number; label: string }[] = []

      for (const m of memberAmounts) {
        if (m.id === collectorId || m.excluded || m.amount <= 0) continue
        const share = round2(m.amount * ratio)
        if (share > 0) payments.push({ to: m.name, amount: share, label: 'share' })
      }

      // Band fund stays with the collector (no transaction created)
      const bandFromShow = round2(bandAmount * ratio)
      const ownShare = round2((memberAmounts.find(m => m.id === collectorId)?.amount ?? 0) * ratio)
      const keeps = round2(ownShare + bandFromShow)

      return { show, collector, payments, keeps }
    }).filter(Boolean) as { show: FinanceShow; collector: Member; payments: { to: string; amount: number; label: string }[]; keeps: number }[]
  }, [selectedShows, collectedByShow, memberAmounts, bandAmount, total, members])

  const showLabel = selectedIds.size === 1
    ? (shows.find(s => selectedIds.has(s.id))?.title ?? 'Show')
    : `${selectedIds.size} shows`

  const handleSplit = () => {
    if (selectedIds.size === 0) return
    // Band fund stays with collector — no transaction created for it
    const shares = memberAmounts.filter(m => !m.excluded && m.amount > 0).map(m => ({
      memberId: m.id,
      amount: m.amount,
      description: `Show split — ${showLabel}`,
    }))
    startTransition(async () => {
      const result = await splitShows([...selectedIds], bandPct, shares)
      if (result && 'error' in result && result.error) toast(result.error, 'error')
    })
  }

  const selectCls = 'rounded-md border border-brand-200 bg-white px-2 py-1 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'
  const inputCls = 'w-28 rounded-md border border-brand-200 bg-white px-3 py-1.5 text-right text-sm tabular-nums focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

  return (
    <div className="space-y-6">
      {/* Show selection with per-show collector */}
      <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Select shows & who collected</h2>
        <div className="space-y-2">
          {shows.map(s => {
            const selected = selectedIds.has(s.id)
            return (
              <div key={s.id}
                className={cn('rounded-lg border transition-colors', selected ? 'border-brand-400 bg-brand-50' : 'border-brand-200')}>
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
                  <span className="text-sm font-bold text-gray-700">{fmt(s.gross_income)}</span>
                </div>
                {/* Per-show collector — only shown when selected */}
                {selected && (
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
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-brand-50 px-4 py-2.5">
          <span className="text-sm font-medium text-gray-600">Total</span>
          <span className="text-lg font-bold text-gray-900">{fmt(total)}</span>
        </div>
      </section>

      {/* Band fund slider + holder */}
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
      {showSettlements.some(s => s.payments.length > 0) && (
        <section className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-600">Cash settlements</h2>
          <div className="space-y-4">
            {showSettlements.map(({ show, collector, payments, keeps }) => (
              <div key={show.id}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {show.title} · {fmt(show.gross_income)} collected by {collector.name}
                </p>
                <div className="space-y-1.5">
                  {payments.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 shadow-sm">
                      <span className="text-xs text-gray-500">{collector.name}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-gray-300" />
                      <span className="text-sm font-medium text-gray-700">{p.to}</span>
                      <span className="ml-auto text-xs text-gray-400">{p.label}</span>
                      <span className="text-sm font-bold text-gray-900">{fmt(p.amount)}</span>
                    </div>
                  ))}
                  {keeps > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-2">
                      <span className="text-sm text-brand-700">{collector.name} keeps</span>
                      <span className="text-sm font-bold text-brand-900">{fmt(keeps)}</span>
                    </div>
                  )}
                </div>
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
          <p className="text-xs text-green-600">from {selectedIds.size} show{selectedIds.size !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={handleSplit} loading={isPending} disabled={selectedIds.size === 0 || total === 0}>
          Confirm & Split →
        </Button>
      </div>
    </div>
  )
}
