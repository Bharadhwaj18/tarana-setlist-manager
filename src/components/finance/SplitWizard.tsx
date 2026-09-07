'use client'

import { useState, useTransition, useMemo, useRef } from 'react'
import { Check, ArrowRight, Download, X, Plus } from 'lucide-react'
import { splitShows, type ShowSplitInput, type SplitPayment } from '@/actions/finance'
import { computeEntitlements, computeAbsorbedAmount, computeShowSettlement, poolShowSettlements, routeSettlement, type Payment } from '@/lib/finance/settlement'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import { exportElementToPdf } from '@/lib/pdf/exportPdf'
import type { FinanceShow, FinanceTransaction } from '@/types/finance'

interface Member { id: string; name: string }
interface Props {
  shows: FinanceShow[]
  members: Member[]
  txnsByShow: Record<string, FinanceTransaction[]>
  memberBalances: Record<string, number>
  /** Each member's current tagged Band Fund balance (category 'fund' only) — used to decide who can safely absorb another payer's share without a real payment existing for it. */
  memberFundBalances: Record<string, number>
}

function round2(n: number) { return Math.round(n * 100) / 100 }
function fmt(n: number) { return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` }

/** Sum of a show's own transactions, per member — credits positive, debits negative. */
function cashPositionsFor(txns: FinanceTransaction[]): Record<string, number> {
  const positions: Record<string, number> = {}
  for (const t of txns) {
    if (!t.member_id) continue
    positions[t.member_id] = round2((positions[t.member_id] ?? 0) + t.amount)
  }
  return positions
}

/** Whoever ended up holding the most cash for a show keeps the Band Fund's cut — no manual override. */
function holderFor(txns: FinanceTransaction[], fallback: string): string {
  const positions = cashPositionsFor(txns)
  const sorted = Object.entries(positions).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] ?? fallback
}

/** The transaction description for one payment — used both when confirming and previewing. */
function descriptionFor(payment: Payment, nameOf: (id: string) => string, showTitles: string): string {
  return payment.from === payment.to
    ? `Covered own share from Band Fund — ${showTitles}`
    : `Paid ${nameOf(payment.to)}'s share — ${showTitles}`
}

export function SplitWizard({ shows, members, txnsByShow, memberBalances, memberFundBalances }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(shows.length === 1 ? [shows[0].id] : []))
  const [bandPct, setBandPct] = useState(20)
  const [involvedByShow, setInvolvedByShow] = useState<Record<string, Set<string>>>(
    Object.fromEntries(shows.map(s => [s.id, new Set(members.map(m => m.id))]))
  )
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const selectedShows = shows.filter(s => selectedIds.has(s.id))

  const netForShow = (showId: string) => {
    const txns = txnsByShow[showId] ?? []
    return round2(txns.reduce((s, t) => s + t.amount, 0))
  }

  // Standing balance "before this batch" — back out every selected show's
  // own contribution to a member's current overall balance, since none of
  // that has actually been settled yet.
  const standingBalanceBeforeBatch = (memberId: string) => {
    const batchContribution = selectedShows.reduce((sum, s) => {
      const positions = cashPositionsFor(txnsByShow[s.id] ?? [])
      return sum + (positions[memberId] ?? 0)
    }, 0)
    return round2((memberBalances[memberId] ?? 0) - batchContribution)
  }

  // Per-show computation: ideal equal split, cash positions, reimbursements,
  // and this show's capacity/amountOwed contribution. Memoized since it
  // feeds both the preview and submit.
  const perShow = useMemo(() => {
    // Absorption (how much of a front the fronter's own balance already
    // covers) is computed sequentially across the batch's shows, not
    // independently per show — otherwise the same person fronting expenses
    // in two selected shows would have their one standing-balance cushion
    // checked against each front separately and counted twice.
    const availableStanding: Record<string, number> = {}
    const standingFor = (id: string) => {
      if (!(id in availableStanding)) availableStanding[id] = standingBalanceBeforeBatch(id)
      return availableStanding[id]
    }

    return selectedShows.map(show => {
      const involved = [...(involvedByShow[show.id] ?? new Set())]
      const net = netForShow(show.id)
      const { memberShares, bandFundAmount } = computeEntitlements(net, involved, bandPct)
      const cashPositions = cashPositionsFor(txnsByShow[show.id] ?? [])
      const bandFundHolderId = holderFor(txnsByShow[show.id] ?? [], members[0]?.id ?? '')

      // Real cash still owed back for a fronted expense, after the
      // fronter's own standing balance covers what it can — the
      // reimbursement floor. 0 whenever their balance never would've gone
      // below ₹0.
      const reimbursements: Record<string, number> = {}
      for (const id of involved) {
        const cashPosition = cashPositions[id] ?? 0
        if (cashPosition >= 0) continue
        const fronted = -cashPosition
        const standing = standingFor(id)
        const absorbed = computeAbsorbedAmount(standing, fronted)
        availableStanding[id] = round2(standing - absorbed) // consume the cushion for later shows in this batch
        const reimbursed = round2(fronted - absorbed)
        if (reimbursed > 0) reimbursements[id] = reimbursed
      }

      const settlement = computeShowSettlement({
        involvedMemberIds: involved,
        entitlements: memberShares,
        bandFundAmount,
        bandFundHolderId,
        cashPositions,
        reimbursements,
      })

      return { show, net, involved, memberShares, bandFundAmount, bandFundHolderId, cashPositions, reimbursements, settlement }
    })
    // netForShow/standingBalanceBeforeBatch derive purely from the args
    // already listed here, and `members` only supplies a fallback id —
    // listing the functions themselves would just churn on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShows, involvedByShow, bandPct, txnsByShow, memberBalances])

  const pooled = useMemo(
    () => poolShowSettlements(perShow.map(p => p.settlement)),
    [perShow]
  )
  // Auto mode's routed payments — a member's own spare capacity from this
  // batch, then their pre-existing Band Fund, cover their own share first;
  // whatever's left routes to whoever can pay it with the fewest, cleanest
  // transactions. See lib/finance/settlement.ts's routeSettlement.
  const payments = useMemo(
    () => routeSettlement(pooled.amountOwed, pooled.capacity, memberFundBalances),
    [pooled, memberFundBalances]
  )

  // Manual mode (default): show each person's amount owed and everyone's
  // Band Fund, and let a person assign who pays whom themselves. Auto mode
  // (WIP): the algorithm's own routed payments above.
  const [mode, setMode] = useState<'manual' | 'auto'>('manual')

  // Manual assignment scratchpad — recipientId -> one or more {payerId,
  // amount} rows, so a recipient's payment can be split across more than
  // one payer if needed, including paying themselves.
  interface Assignment { payerId: string; amount: number }
  const [assignmentsByRecipient, setAssignmentsByRecipient] = useState<Record<string, Assignment[]>>({})

  // Every calculation behind each person's amount, show by show — the full
  // audit trail behind the pooled amountOwed figure.
  interface BreakdownLine {
    showTitle: string
    entitlement: number
    cashPosition: number
    reimbursed: number
    isBandFundHolder: boolean
    bandFundAmount: number
    /** What this show adds to their pooled amount owed — their cut, plus any real reimbursement for fronting. */
    owedFromShow: number
  }
  const breakdownByPerson = useMemo(() => {
    const map: Record<string, BreakdownLine[]> = {}
    for (const p of perShow) {
      for (const id of p.involved) {
        const entitlement = p.memberShares[id] ?? 0
        const cashPosition = p.cashPositions[id] ?? 0
        const reimbursed = p.reimbursements[id] ?? 0
        const isBandFundHolder = id === p.bandFundHolderId
        ;(map[id] ??= []).push({
          showTitle: p.show.title,
          entitlement,
          cashPosition,
          reimbursed,
          isBandFundHolder,
          bandFundAmount: p.bandFundAmount,
          owedFromShow: round2(entitlement + reimbursed),
        })
      }
    }
    return map
  }, [perShow])

  const totalNet = perShow.reduce((s, p) => s + p.net, 0)
  const totalBandFund = perShow.reduce((s, p) => s + p.bandFundAmount, 0)

  // Everyone touched by any selected show, in a stable order.
  const allInvolvedIds = members.map(m => m.id).filter(id => perShow.some(p => p.involved.includes(id)))

  const amountOwedFor = (id: string) => pooled.amountOwed[id] ?? 0

  const assignmentsFor = (recipientId: string): Assignment[] => {
    const existing = assignmentsByRecipient[recipientId]
    if (existing && existing.length > 0) return existing
    return [{ payerId: '', amount: amountOwedFor(recipientId) }]
  }

  const updateAssignment = (recipientId: string, index: number, patch: Partial<Assignment>) => {
    setAssignmentsByRecipient(prev => ({
      ...prev,
      [recipientId]: assignmentsFor(recipientId).map((a, i) => i === index ? { ...a, ...patch } : a),
    }))
  }
  const addAssignmentRow = (recipientId: string) => {
    setAssignmentsByRecipient(prev => ({
      ...prev,
      [recipientId]: [...assignmentsFor(recipientId), { payerId: '', amount: 0 }],
    }))
  }
  const removeAssignmentRow = (recipientId: string, index: number) => {
    setAssignmentsByRecipient(prev => {
      const rows = assignmentsFor(recipientId).filter((_, i) => i !== index)
      return { ...prev, [recipientId]: rows.length > 0 ? rows : [{ payerId: '', amount: 0 }] }
    })
  }

  // Each payer's real available money — same figure as the main Finance
  // page's Member Balances — minus everything currently assigned to them
  // (as payer, for any recipient, including themselves) so far. Updates
  // live as assignments change.
  const remainingFundFor = (memberId: string) => {
    const totalAssigned = allInvolvedIds
      .flatMap(id => assignmentsFor(id))
      .filter(a => a.payerId === memberId)
      .reduce((s, a) => s + (a.amount || 0), 0)
    return round2((memberBalances[memberId] ?? 0) - totalAssigned)
  }

  // Manual mode's assignments, translated directly into payments — every
  // row (including a self-assignment) becomes one payment, exactly the
  // same shape routeSettlement produces for Auto mode.
  const manualPayments: Payment[] = allInvolvedIds.flatMap(id =>
    assignmentsFor(id)
      .filter(a => a.payerId && a.amount > 0)
      .map(a => ({ from: a.payerId, to: id, amount: round2(a.amount) }))
  )
  // Every recipient needs their full amount assigned to a payer (or payers)
  // before this can be confirmed.
  const manualFullyAssigned = allInvolvedIds.every(id => {
    const assigned = round2(assignmentsFor(id).reduce((s, a) => s + (a.payerId ? (a.amount || 0) : 0), 0))
    return Math.abs(amountOwedFor(id) - assigned) < 0.01
  })

  const toggleShow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleInvolved = (showId: string, memberId: string) => {
    setInvolvedByShow(prev => {
      const next = new Set(prev[showId] ?? [])
      if (next.has(memberId)) next.delete(memberId); else next.add(memberId)
      return { ...prev, [showId]: next }
    })
  }

  const showsReady = perShow.length > 0 && perShow.every(p => p.involved.length > 0)
  // Auto mode can always confirm once shows are ready — the algorithm
  // routes everything. Manual mode also needs every recipient's full
  // amount actually assigned to a payer first.
  const canConfirm = showsReady && (mode === 'auto' || manualFullyAssigned)

  const nameOf = (id: string) => members.find(m => m.id === id)?.name ?? 'Unknown'

  const handleSplit = () => {
    if (!canConfirm) return
    const shows_: ShowSplitInput[] = selectedShows.map(s => ({ showId: s.id, showTitle: s.title }))
    const showTitles = selectedShows.map(s => s.title).join(', ')
    const activePayments = mode === 'auto' ? payments : manualPayments
    const splitPayments: SplitPayment[] = activePayments
      .filter(p => p.amount > 0)
      .map(p => ({ from: p.from, to: p.to, amount: round2(p.amount), description: descriptionFor(p, nameOf, showTitles) }))
    startTransition(async () => {
      const result = await splitShows(shows_, splitPayments)
      if (result && 'error' in result && result.error) toast(result.error, 'error')
    })
  }

  const pdfRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadReport = async () => {
    if (!pdfRef.current) return
    setIsDownloading(true)
    try {
      // Reflect whichever mode is active — the manual assignments if
      // that's what was actually decided, or the algorithm's routing.
      const activePayments = mode === 'auto' ? payments : manualPayments

      const rows: SplitReportRow[] = allInvolvedIds.map(id => {
        const lines: SplitReportLine[] = breakdownByPerson[id] ?? []
        const outgoing = activePayments.filter(p => p.from === id && p.to !== id)
        const self = activePayments.find(p => p.from === id && p.to === id)
        const incoming = activePayments.filter(p => p.to === id && p.from !== id)
        // Same logic as the Manual mode Band Fund balances panel: real
        // balance minus whatever they're paying out for anyone (including
        // themselves) — how much they still have spare, not a projected
        // final balance including what they're due to receive.
        const paidOut = round2(activePayments.filter(p => p.from === id).reduce((s, p) => s + p.amount, 0))
        const newFundBalance = round2((memberBalances[id] ?? 0) - paidOut)
        return {
          name: nameOf(id),
          lines,
          owed: amountOwedFor(id),
          selfPaid: self?.amount ?? 0,
          outgoing: outgoing.map(p => ({ to: nameOf(p.to), amount: p.amount })),
          incoming: incoming.map(p => ({ from: nameOf(p.from), amount: p.amount })),
          newFundBalance,
        }
      })

      // One card per show — the exact same shape as the on-screen show
      // preview (title, net, its own transactions, each person's plain cut
      // and the plain Band Fund %), so the report reads as a full record
      // of every show that went into this split.
      const showDetails: SplitReportShow[] = perShow.map(p => ({
        showTitle: p.show.title,
        net: p.net,
        transactions: (txnsByShow[p.show.id] ?? []).map(t => ({
          description: t.description,
          memberName: t.member_id ? nameOf(t.member_id) : null,
          amount: t.amount,
        })),
        cuts: p.involved.map(id => ({ name: nameOf(id), cut: p.memberShares[id] ?? 0 })),
        bandFundHolderName: nameOf(p.bandFundHolderId),
        bandFundAmount: p.bandFundAmount,
      }))

      const el = pdfRef.current
      el.innerHTML = buildSplitReportHtml(selectedShows.map(s => s.title), bandPct, showDetails, rows, totalNet, totalBandFund)
      el.style.display = 'block'
      await exportElementToPdf(el, `tarana-split-${new Date().toISOString().slice(0, 10)}.pdf`)
      el.style.display = 'none'
      el.innerHTML = ''
      toast('Report downloaded', 'success')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hidden PDF render target */}
      <div ref={pdfRef} style={{ display: 'none', position: 'fixed', left: '-9999px', top: 0, width: '794px', background: '#fff', padding: '32px', fontFamily: 'sans-serif', fontSize: '13px' }} />

      {/* Show selection */}
      <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Select shows to split together</h2>
        <div className="space-y-2">
          {shows.map(s => {
            const selected = selectedIds.has(s.id)
            const net = netForShow(s.id)
            const txns = txnsByShow[s.id] ?? []
            const involved = involvedByShow[s.id] ?? new Set()
            const showData = perShow.find(p => p.show.id === s.id)

            return (
              <div key={s.id} className={cn('rounded-lg border transition-colors', selected ? 'border-brand-400 bg-brand-50' : 'border-brand-200')}>
                <button type="button" onClick={() => toggleShow(s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                    selected ? 'border-brand-400 bg-brand-400' : 'border-gray-300')}>
                    {selected && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{s.title}</p>
                    {s.show_date && <p className="text-xs text-gray-400">
                      {new Date(s.show_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                      {s.venue ? ` · ${s.venue}` : ''}
                    </p>}
                  </div>
                  <p className="text-sm font-bold text-gray-700">{fmt(net)}</p>
                </button>

                {selected && (
                  <div className="space-y-3 border-t border-brand-100 px-4 py-3">
                    {/* Transactions breakdown */}
                    {txns.length > 0 && (
                      <div className="space-y-1 text-xs text-gray-500">
                        {txns.map(t => (
                          <div key={t.id} className="flex items-center justify-between">
                            <span>{t.description} {t.member_id && <span className="text-gray-400">({nameOf(t.member_id)})</span>}</span>
                            <span className={t.amount >= 0 ? 'text-green-600' : 'text-red-500'}>
                              {t.amount >= 0 ? '+' : '−'}{fmt(t.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Involved members */}
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-gray-500">Involved</p>
                      <div className="flex flex-wrap gap-1.5">
                        {members.map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => toggleInvolved(s.id, m.id)}
                            className={cn('rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                              involved.has(m.id) ? 'bg-brand-400 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}
                          >
                            {m.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Ideal equal split preview — the plain {bandPct}/{100-bandPct} split */}
                    {showData && showData.involved.length > 0 && (
                      <div className="space-y-1 border-t border-brand-100 pt-2 text-xs">
                        {showData.involved.map(id => (
                          <div key={id} className="flex items-center justify-between text-gray-600">
                            <span>{nameOf(id)}</span>
                            <span className="font-semibold tabular-nums">{fmt(showData.memberShares[id] ?? 0)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-1 text-brand-600">
                          <span>Band Fund ({bandPct}%) <span className="text-gray-400">(kept by {nameOf(showData.bandFundHolderId)})</span></span>
                          <span className="font-semibold tabular-nums">{fmt(showData.bandFundAmount)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-brand-50 px-4 py-2.5">
          <span className="text-sm font-medium text-gray-600">Total net</span>
          <span className="text-lg font-bold text-gray-900">{fmt(totalNet)}</span>
        </div>
      </section>

      {/* Band fund slider */}
      <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Band fund cut</h2>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-gray-500">Band fund <span className="font-bold text-brand-600">{bandPct}%</span> = {fmt(totalBandFund)}</span>
          <span className="text-gray-500">Artists <span className="font-bold text-green-600">{100 - bandPct}%</span> (equal split)</span>
        </div>
        <input type="range" min={0} max={50} step={5} value={bandPct}
          onChange={e => setBandPct(Number(e.target.value))}
          className="w-full cursor-pointer accent-brand-400" />
        <div className="mt-1 flex justify-between text-xs text-gray-400"><span>0%</span><span>50%</span></div>
      </section>

      {/* Manual / Auto mode switch */}
      {perShow.length > 0 && (
        <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-1">
          <button type="button" onClick={() => setMode('manual')}
            className={cn('flex-1 rounded-md py-2 text-sm font-semibold transition-colors',
              mode === 'manual' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            Manual
          </button>
          <button type="button" onClick={() => setMode('auto')}
            className={cn('flex-1 rounded-md py-2 text-sm font-semibold transition-colors',
              mode === 'auto' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            Auto mode (WIP)
          </button>
        </div>
      )}

      {/* Manual mode — the plain numbers, plus assign your own payer(s) per recipient. */}
      {mode === 'manual' && perShow.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-600">Who&apos;s supposed to get what</h2>
          <div className="space-y-2.5">
            {allInvolvedIds.map(id => {
              const owed = amountOwedFor(id)
              const rows = assignmentsFor(id)
              const assigned = round2(rows.reduce((s, a) => s + (a.payerId ? (a.amount || 0) : 0), 0))
              const remaining = round2(owed - assigned)

              return (
                <div key={id} className="rounded-lg bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{nameOf(id)}</span>
                    <span className="text-sm font-bold tabular-nums text-green-600">Gets {fmt(owed)}</span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {rows.map((row, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <select
                          value={row.payerId}
                          onChange={e => updateAssignment(id, i, { payerId: e.target.value })}
                          className="flex-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
                        >
                          <option value="">Paid by…</option>
                          {members.map(m => (
                            <option key={m.id} value={m.id}>{m.id === id ? `${m.name} (self, from Band Fund)` : m.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={row.amount || ''}
                          onChange={e => updateAssignment(id, i, { amount: Number(e.target.value) })}
                          placeholder="Amount"
                          className="w-24 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs tabular-nums focus:border-brand-400 focus:outline-none"
                        />
                        {rows.length > 1 && (
                          <button type="button" onClick={() => removeAssignmentRow(id, i)} aria-label="Remove" className="shrink-0 text-gray-300 hover:text-red-500">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-0.5">
                      <button type="button" onClick={() => addAssignmentRow(id)} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                        <Plus className="h-3 w-3" /> Add payer
                      </button>
                      {Math.abs(remaining) > 0.01 && (
                        <span className={cn('text-xs font-medium tabular-nums', remaining > 0 ? 'text-amber-600' : 'text-red-500')}>
                          {remaining > 0 ? `${fmt(remaining)} unassigned` : `${fmt(-remaining)} over-assigned`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <h2 className="mb-4 mt-6 text-sm font-semibold text-gray-600">Band Fund balances</h2>
          <div className="space-y-1.5">
            {members.map(m => {
              const starting = memberBalances[m.id] ?? 0
              const remaining = remainingFundFor(m.id)
              return (
                <div key={m.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-2.5 shadow-sm">
                  <span className="text-sm font-medium text-gray-700">{m.name}</span>
                  <div className="text-right">
                    <span className={cn('text-sm font-bold tabular-nums', remaining < 0 ? 'text-red-500' : 'text-brand-600')}>
                      {remaining < 0 ? '−' : ''}{fmt(remaining)}
                    </span>
                    {Math.abs(remaining - starting) > 0.01 && (
                      <p className="text-[10px] text-gray-400">was {fmt(starting)}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="mt-4 text-xs text-gray-400">
            Assign who pays whom above — Band Fund balances update as you go. Switch to Auto mode for the algorithm&apos;s own suggestion.
          </p>
        </section>
      )}

      {mode === 'auto' && (
      <>
      {/* Settlement */}
      {payments.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-600">
            Settlement{selectedShows.length > 1 ? ' — pooled across all selected shows' : ''}
          </h2>
          <div className="space-y-1.5">
            {payments.map((p, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 shadow-sm">
                {p.from === p.to ? (
                  <span className="text-sm font-medium text-gray-700">{nameOf(p.from)} keeps their own share (Band Fund)</span>
                ) : (
                  <>
                    <span className="text-sm font-medium text-gray-700">{nameOf(p.from)}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                    <span className="text-sm font-medium text-gray-700">{nameOf(p.to)}</span>
                  </>
                )}
                <span className="ml-auto text-sm font-bold text-gray-900">{fmt(p.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Complete breakdown — every number behind every payment above */}
      {allInvolvedIds.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-600">Complete breakdown</h2>
          <div className="space-y-4">
            {allInvolvedIds.map(id => {
              const lines = breakdownByPerson[id] ?? []
              const owed = amountOwedFor(id)
              const outgoing = payments.filter(p => p.from === id && p.to !== id)
              const self = payments.find(p => p.from === id && p.to === id)
              const incoming = payments.filter(p => p.to === id && p.from !== id)
              const paidOut = round2(payments.filter(p => p.from === id).reduce((s, p) => s + p.amount, 0))

              return (
                <div key={id} className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="mb-2.5 text-sm font-semibold text-gray-800">{nameOf(id)}</p>
                  <div className="space-y-2 border-b border-gray-100 pb-2.5">
                    {lines.map((line, i) => (
                      <div key={i} className="text-xs">
                        <p className="mb-1 font-medium text-gray-500">{line.showTitle}</p>
                        <div className="space-y-0.5 pl-2 text-gray-600">
                          <div className="flex items-center justify-between">
                            <span>Equal share</span>
                            <span className="tabular-nums">+{fmt(line.entitlement)}</span>
                          </div>
                          {line.cashPosition < 0 && (
                            <>
                              <div className="flex items-center justify-between text-gray-400">
                                <span>Fronted from balance</span>
                                <span className="tabular-nums">−{fmt(line.cashPosition)}</span>
                              </div>
                              {line.reimbursed > 0 && (
                                <div className="flex items-center justify-between text-green-600">
                                  <span>Reimbursement (balance would&apos;ve gone below ₹0)</span>
                                  <span className="tabular-nums">+{fmt(line.reimbursed)}</span>
                                </div>
                              )}
                            </>
                          )}
                          {line.cashPosition > 0 && (
                            <div className="flex items-center justify-between text-red-500">
                              <span>Cash you handled for the show (needs to go back)</span>
                              <span className="tabular-nums">−{fmt(line.cashPosition)}</span>
                            </div>
                          )}
                          {line.isBandFundHolder && (
                            <div className="flex items-center justify-between text-brand-600">
                              <span>+ Band Fund cut (you keep it)</span>
                              <span className="tabular-nums">+{fmt(line.bandFundAmount)}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between border-t border-gray-100 pt-0.5 font-medium text-gray-700">
                            <span>Owed from this show</span>
                            <span className="tabular-nums text-green-600">+{fmt(line.owedFromShow)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2.5 text-sm font-semibold text-gray-800">
                    <span>Total owed</span>
                    <span className="tabular-nums text-green-600">{fmt(owed)}</span>
                  </div>
                  {paidOut > 0 && (
                    <div className="flex items-center justify-between pt-1 text-sm font-semibold text-gray-800">
                      <span>Total to pay out</span>
                      <span className="tabular-nums">{fmt(paidOut)}</span>
                    </div>
                  )}
                  <div className="mt-1.5 space-y-1">
                    {self && (
                      <p className="text-xs text-gray-500">Keeps {fmt(self.amount)} of their own share from Band Fund</p>
                    )}
                    {outgoing.map((p, i) => (
                      <p key={`out-${i}`} className="text-xs text-gray-500">
                        → Pays {nameOf(p.to)} {fmt(p.amount)}
                      </p>
                    ))}
                    {incoming.map((p, i) => (
                      <p key={`in-${i}`} className="text-xs text-gray-500">
                        ← Receives {fmt(p.amount)} from {nameOf(p.from)}
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
      </>
      )}

      {/* Report */}
      {showsReady && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={handleDownloadReport} loading={isDownloading}>
            <Download className="h-4 w-4" /> Download Report
          </Button>
        </div>
      )}

      {/* Confirm */}
      <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-green-800">
            {fmt(totalNet - totalBandFund)} to artists, {fmt(totalBandFund)} to Band Fund
          </p>
          <p className="text-xs text-green-600">
            from {selectedShows.length} show{selectedShows.length !== 1 ? 's' : ''} · net {fmt(totalNet)}
            {mode === 'manual' && !manualFullyAssigned && ' · assign every recipient a payer to confirm'}
          </p>
        </div>
        <Button onClick={handleSplit} loading={isPending} disabled={!canConfirm}>
          Confirm & Split →
        </Button>
      </div>
    </div>
  )
}

interface SplitReportLine {
  showTitle: string
  entitlement: number
  cashPosition: number
  reimbursed: number
  isBandFundHolder: boolean
  bandFundAmount: number
  owedFromShow: number
}

interface SplitReportRow {
  name: string
  lines: SplitReportLine[]
  owed: number
  selfPaid: number
  outgoing: { to: string; amount: number }[]
  incoming: { from: string; amount: number }[]
  /** Their Band Fund specifically — real balance minus whatever they're paying out. */
  newFundBalance: number
}

interface SplitReportShow {
  showTitle: string
  net: number
  transactions: { description: string; memberName: string | null; amount: number }[]
  cuts: { name: string; cut: number }[]
  bandFundHolderName: string
  bandFundAmount: number
}

function buildSplitReportHtml(
  showTitles: string[],
  bandPct: number,
  shows: SplitReportShow[],
  rows: SplitReportRow[],
  totalNet: number,
  totalBandFund: number
): string {
  const sign = (n: number) => n >= 0 ? '+' : '−'
  const fmt = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  return `
    <div>
      <h1 style="font-size:20px;font-weight:bold;margin-bottom:4px;">Tarana Split Report</h1>
      <p style="color:#666;margin-bottom:4px;">${showTitles.join(', ')}</p>
      <p style="color:#666;margin-bottom:20px;font-size:12px;">Band Fund ${bandPct}% · Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <h2 style="font-size:13px;font-weight:bold;margin:0 0 8px;color:#333;">How this was worked out</h2>
      <p style="font-size:11px;color:#666;line-height:1.6;margin:0 0 20px;">
        Each show's money is split ${bandPct}% to the Band Fund and the rest equally among everyone who played it.
        Anyone who spent their own money on the show gets it back — but only the part that would've taken their own
        balance below ₹0; if their existing balance already covers it, no cash needs to move for that part. Every
        payment (including someone covering their own share from their own Band Fund) is a straightforward payer to
        recipient — nobody's payment ever gets split between two people unless it's truly unavoidable.
      </p>

      <h2 style="font-size:13px;font-weight:bold;margin:0 0 10px;color:#333;">Every show in this split</h2>
      ${shows.map(s => `
        <div style="border:1px solid #eee;border-radius:8px;padding:14px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
            <p style="font-weight:bold;font-size:13px;margin:0;">${s.showTitle}</p>
            <p style="font-weight:bold;font-size:13px;margin:0;">${fmt(s.net)}</p>
          </div>
          ${s.transactions.length > 0 ? `
            <div style="font-size:11px;color:#666;margin-bottom:8px;">
              ${s.transactions.map(t => `
                <div style="display:flex;justify-content:space-between;">
                  <span>${t.description}${t.memberName ? ` (${t.memberName})` : ''}</span>
                  <span style="color:${t.amount >= 0 ? '#16a34a' : '#dc2626'};">${t.amount >= 0 ? '+' : '−'}${fmt(t.amount)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <tbody>
              ${s.cuts.map((c, i) => `
                <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
                  <td style="padding:5px 10px;">${c.name}</td>
                  <td style="padding:5px 10px;text-align:right;font-weight:600;">${fmt(c.cut)}</td>
                </tr>
              `).join('')}
              <tr>
                <td style="padding:5px 10px;color:#7c3aed;">Band Fund (${bandPct}%) <span style="color:#999;">kept by ${s.bandFundHolderName}</span></td>
                <td style="padding:5px 10px;text-align:right;font-weight:600;color:#7c3aed;">${fmt(s.bandFundAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `).join('')}

      <h2 style="font-size:13px;font-weight:bold;margin:20px 0 8px;color:#333;">At a glance</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px;">
        <thead>
          <tr style="background:#f5f0ff;">
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #d4c8f4;">Member</th>
            <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #d4c8f4;">Owed (all shows)</th>
            <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #d4c8f4;">Band Fund left</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
              <td style="padding:6px 10px;">${r.name}</td>
              <td style="padding:6px 10px;text-align:right;font-weight:600;">${fmt(r.owed)}</td>
              <td style="padding:6px 10px;text-align:right;font-weight:600;color:#7c3aed;">${fmt(r.newFundBalance)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2 style="font-size:13px;font-weight:bold;margin:0 0 10px;color:#333;">Full breakdown, person by person</h2>
      ${rows.map(r => `
        <div style="border:1px solid #eee;border-radius:8px;padding:14px;margin-bottom:12px;">
          <p style="font-weight:bold;font-size:13px;margin:0 0 8px;">${r.name}</p>
          ${r.lines.map(l => `
            <div style="font-size:11px;margin-bottom:6px;">
              <p style="margin:0 0 3px;color:#666;font-weight:600;">${l.showTitle}</p>
              <div style="padding-left:8px;color:#555;">
                <div style="display:flex;justify-content:space-between;"><span>Your cut — ${bandPct}% goes to Band Fund, the rest split equally</span><span>+${fmt(l.entitlement)}</span></div>
                ${l.cashPosition < 0 ? `<div style="display:flex;justify-content:space-between;color:#999;"><span>You paid this out of your own pocket for the show</span><span>−${fmt(l.cashPosition)}</span></div>` : ''}
                ${l.reimbursed > 0 ? `<div style="display:flex;justify-content:space-between;color:#16a34a;"><span>Paid back — the part that would've dropped your balance below ₹0</span><span>+${fmt(l.reimbursed)}</span></div>` : ''}
                ${l.cashPosition > 0 ? `<div style="display:flex;justify-content:space-between;color:#dc2626;"><span>Cash you collected for the show, beyond your own cut — needs to go back</span><span>−${fmt(l.cashPosition)}</span></div>` : ''}
                ${l.isBandFundHolder ? `<div style="display:flex;justify-content:space-between;color:#7c3aed;"><span>You're holding this show's Band Fund cut</span><span>+${fmt(l.bandFundAmount)}</span></div>` : ''}
                <div style="display:flex;justify-content:space-between;font-weight:600;border-top:1px solid #eee;padding-top:2px;margin-top:2px;"><span>Owed from this show</span><span>+${fmt(l.owedFromShow)}</span></div>
              </div>
            </div>
          `).join('')}
          <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:12px;border-top:1px solid #eee;padding-top:6px;margin-top:6px;">
            <span>Total owed</span>
            <span style="color:#16a34a;">${fmt(r.owed)}</span>
          </div>
          ${r.selfPaid > 0 ? `<p style="font-size:11px;color:#666;margin:4px 0 0;">Keeps ${fmt(r.selfPaid)} of their own share from Band Fund</p>` : ''}
          ${r.outgoing.map(p => `<p style="font-size:11px;color:#666;margin:2px 0 0;">→ Pays ${p.to} ${fmt(p.amount)}</p>`).join('')}
          ${r.incoming.map(p => `<p style="font-size:11px;color:#666;margin:2px 0 0;">← Gets ${fmt(p.amount)} from ${p.from}</p>`).join('')}
          <div style="border-top:1px dashed #eee;padding-top:6px;margin-top:6px;font-size:11px;">
            <div style="display:flex;justify-content:space-between;font-weight:600;color:#7c3aed;"><span>Band Fund you're left holding</span><span>${fmt(r.newFundBalance)}</span></div>
          </div>
        </div>
      `).join('')}

      <div style="background:#f5f0ff;border-radius:6px;padding:10px 14px;font-size:12px;margin-top:8px;">
        <p style="margin:0 0 4px;"><b>Total from these shows:</b> ${sign(totalNet)}${fmt(totalNet)}</p>
        <p style="margin:0;"><b>Band Fund:</b> ${fmt(totalBandFund)} &nbsp;·&nbsp; <b>To artists:</b> ${fmt(totalNet - totalBandFund)}</p>
      </div>
    </div>
  `
}
