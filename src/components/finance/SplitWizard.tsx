'use client'

import { useState, useTransition, useMemo, useRef } from 'react'
import { Check, ArrowRight, Download, X, Plus } from 'lucide-react'
import { splitShows, type ShowSplitInput } from '@/actions/finance'
import { computeEntitlements, computeAbsorbedAmount, computeShowSettlementNets, computeSettlementLedgerDelta, poolSettlementNets, minimizeSettlement } from '@/lib/finance/settlement'
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
  /** Each member's current tagged Band Fund balance (category 'fund' only) — this section only tracks Band Fund, and settlement routing runs on this, not overall balance. */
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

  // Per-show computation: ideal equal split, cash positions, absorptions,
  // and settlement nets. Memoized since it feeds both the preview and submit.
  const perShow = useMemo(() => {
    // Absorptions are computed sequentially across the batch (in show
    // order), not independently per show — otherwise the same person
    // fronting expenses in two selected shows would have their one
    // standing-balance cushion checked against each front separately and
    // counted twice, when it can really only cover so much combined.
    const availableStanding: Record<string, number> = {}
    const standingFor = (id: string) => {
      if (!(id in availableStanding)) availableStanding[id] = standingBalanceBeforeBatch(id)
      return availableStanding[id]
    }

    return selectedShows.map(show => {
      const involved = [...(involvedByShow[show.id] ?? new Set())]
      const net = netForShow(show.id)
      const { memberShares, bandFundAmount: baseBandFundAmount } = computeEntitlements(net, involved, bandPct)
      const cashPositions = cashPositionsFor(txnsByShow[show.id] ?? [])
      const bandFundHolderId = holderFor(txnsByShow[show.id] ?? [], members[0]?.id ?? '')

      const absorptions = involved
        .filter(id => (cashPositions[id] ?? 0) < 0)
        .map(id => {
          const fronted = -(cashPositions[id] ?? 0)
          const standing = standingFor(id)
          const amount = computeAbsorbedAmount(standing, fronted)
          availableStanding[id] = round2(standing - amount) // consume the cushion for later shows in this batch
          return { memberId: id, amount }
        })
        .filter(a => a.amount > 0)

      // Whatever a member's own balance covers doesn't need to be paid back
      // in cash — that saved amount becomes extra Band Fund for this show,
      // on top of the usual cut, so the holder's recorded balance matches
      // what they actually end up keeping (nothing else accounts for it).
      const totalAbsorbed = round2(absorptions.reduce((s, a) => s + a.amount, 0))
      const bandFundAmount = round2(baseBandFundAmount + totalAbsorbed)

      const nets = computeShowSettlementNets({
        involvedMemberIds: involved,
        entitlements: memberShares,
        bandFundAmount,
        bandFundHolderId,
        cashPositions,
        absorptions: Object.fromEntries(absorptions.map(a => [a.memberId, a.amount])),
      })

      return { show, net, involved, memberShares, bandFundAmount, baseBandFundAmount, totalAbsorbed, bandFundHolderId, cashPositions, absorptions, nets }
    })
    // netForShow/standingBalanceBeforeBatch derive purely from the args
    // already listed here, and `members` only supplies a fallback id —
    // listing the functions themselves would just churn on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShows, involvedByShow, bandPct, txnsByShow, memberBalances])

  const pooledNets = useMemo(() => poolSettlementNets(perShow.map(p => p.nets)), [perShow])
  // Each member's tagged Band Fund balance drives who self-satisfies their
  // own share and who consolidates the rest (see minimizeSettlement).
  const settlement = useMemo(() => minimizeSettlement(pooledNets, memberFundBalances), [pooledNets, memberFundBalances])
  const payments = settlement.payments
  const consolidationAbsorptions = settlement.consolidationAbsorptions
  const selfSatisfactions = settlement.selfSatisfactions

  // Manual mode (default): just show each person's cut and everyone's Band
  // Fund, and let a person assign who pays whom themselves. Auto mode
  // (WIP): the algorithm's own routed payment instructions.
  const [mode, setMode] = useState<'manual' | 'auto'>('manual')

  // Manual assignment scratchpad — recipientId -> one or more {payerId,
  // amount} rows, so a recipient's payment can be split across more than
  // one payer if needed. Purely a planning aid, not written anywhere; the
  // actual confirm action still runs through Auto mode.
  interface Assignment { payerId: string; amount: number }
  const [assignmentsByRecipient, setAssignmentsByRecipient] = useState<Record<string, Assignment[]>>({})

  // Every calculation behind each person's final number, show by show — the
  // full audit trail, not just the resulting payment.
  interface BreakdownLine {
    showTitle: string
    entitlement: number
    cashPosition: number
    isBandFundHolder: boolean
    /** Combined Band Fund for this show — base cut plus any absorbed savings — used in showNet math. */
    bandFundAmount: number
    /** Just the plain {bandPct}% cut, before any absorbed-savings addition — for display. */
    baseBandFundAmount: number
    /** The extra Band Fund from someone's fronted expense not needing reimbursement — 0 most of the time. */
    extraBandFund: number
    absorbed: number
    /** Real cash still owed back for what they fronted, after their own
     * balance covers what it can — 0 whenever their balance never would've
     * gone below zero. */
    reimbursed: number
    /** What this show actually nets them, all in — entitlement, reconciled
     * against cash they already handled, the reimbursement-floor correction,
     * and the Band Fund cut if they're holding it. Positive = they come out
     * ahead on this show; negative = they still owe it back. */
    showNet: number
    /** Their own money from this show — the cut, reconciled against cash
     * they already handled. This is NOT Band Fund, even for the holder —
     * it's personal, same as anyone else's cut. */
    personalNet: number
    /** Only the Band Fund portion of showNet — 0 unless they're the holder. */
    fundNet: number
  }
  const breakdownByPerson = useMemo(() => {
    const map: Record<string, BreakdownLine[]> = {}
    for (const p of perShow) {
      for (const id of p.involved) {
        const absorption = p.absorptions.find(a => a.memberId === id)
        const absorbed = absorption?.amount ?? 0
        const entitlement = p.memberShares[id] ?? 0
        const cashPosition = p.cashPositions[id] ?? 0
        const fronted = cashPosition < 0 ? -cashPosition : 0
        const reimbursed = round2(fronted - absorbed)
        const isBandFundHolder = id === p.bandFundHolderId
        const personalNet = round2(computeSettlementLedgerDelta(entitlement, cashPosition) - absorbed)
        const fundNet = isBandFundHolder ? p.bandFundAmount : 0
        const showNet = round2(personalNet + fundNet)
        ;(map[id] ??= []).push({
          showTitle: p.show.title,
          entitlement,
          cashPosition,
          isBandFundHolder,
          bandFundAmount: p.bandFundAmount,
          baseBandFundAmount: p.baseBandFundAmount,
          extraBandFund: p.totalAbsorbed,
          absorbed,
          reimbursed,
          showNet,
          personalNet,
          fundNet,
        })
      }
    }
    return map
  }, [perShow])

  const peopleInSettlement = Object.keys(pooledNets).filter(id => Math.abs(pooledNets[id]) > 0.01)

  const totalNet = perShow.reduce((s, p) => s + p.net, 0)
  const totalBandFund = perShow.reduce((s, p) => s + p.bandFundAmount, 0)

  // Chaining can route a payment through someone who isn't a direct
  // recipient — their true net is out minus in, not just one direction's
  // sum. Shared by the on-screen breakdown and the downloadable report;
  // takes whichever payments list is active (auto-routed or manual).
  const netFor = (id: string, paymentsList: { from: string; to: string; amount: number }[]) => {
    const outgoing = paymentsList.filter(p => p.from === id)
    const incoming = paymentsList.filter(p => p.to === id)
    return round2(outgoing.reduce((s, p) => s + p.amount, 0) - incoming.reduce((s, p) => s + p.amount, 0))
  }

  // Everyone touched by any selected show, in a stable order — not just
  // those left with a nonzero settlement, since the report should show
  // entitlement and new balance for someone who's already exactly settled.
  const allInvolvedIds = members.map(m => m.id).filter(id => perShow.some(p => p.involved.includes(id)))

  const cutFor = (id: string) => round2((breakdownByPerson[id] ?? []).reduce((s, l) => s + l.entitlement, 0))

  const assignmentsFor = (recipientId: string): Assignment[] => {
    const existing = assignmentsByRecipient[recipientId]
    if (existing && existing.length > 0) return existing
    return [{ payerId: '', amount: cutFor(recipientId) }]
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
  // page's Member Balances (their whole balance, not just the narrow
  // tagged-fund slice), minus everything currently assigned to them across
  // every recipient so far. Someone paying another member uses whatever
  // they're actually holding, not just their "official" fund cut. Updates
  // live as assignments change.
  const remainingFundFor = (memberId: string) => {
    const totalAssigned = allInvolvedIds
      .flatMap(id => assignmentsFor(id))
      .filter(a => a.payerId === memberId)
      .reduce((s, a) => s + (a.amount || 0), 0)
    return round2((memberBalances[memberId] ?? 0) - totalAssigned)
  }

  // Manual mode's assignments, translated into the same shapes the
  // algorithm produces, so the report and confirm logic can be shared. A
  // recipient assigned to pay themselves is a self-satisfaction (their own
  // Band Fund covers it, no cash moves) — everyone else is a real payment.
  const manualPayments = allInvolvedIds.flatMap(id =>
    assignmentsFor(id)
      .filter(a => a.payerId && a.payerId !== id && a.amount > 0)
      .map(a => ({ from: a.payerId, to: id, amount: round2(a.amount) }))
  )
  const manualSelfSatisfactions: Record<string, number> = {}
  for (const id of allInvolvedIds) {
    const selfAmount = round2(
      assignmentsFor(id).filter(a => a.payerId === id).reduce((s, a) => s + (a.amount || 0), 0)
    )
    if (selfAmount > 0.01) manualSelfSatisfactions[id] = selfAmount
  }
  // Every recipient needs a payer chosen for their full cut before this
  // can be confirmed — an unassigned or over-assigned row blocks it.
  const manualFullyAssigned = allInvolvedIds.every(id => {
    const assigned = round2(assignmentsFor(id).reduce((s, a) => s + (a.payerId ? (a.amount || 0) : 0), 0))
    return Math.abs(cutFor(id) - assigned) < 0.01
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
  // routes everything. Manual mode also needs every recipient's full cut
  // actually assigned to a payer first.
  const canConfirm = showsReady && (mode === 'auto' || manualFullyAssigned)

  const handleSplit = () => {
    if (!canConfirm) return
    const payload: ShowSplitInput[] = perShow.map(p => ({
      showId: p.show.id,
      showTitle: p.show.title,
      involvedMemberIds: p.involved,
      entitlements: p.memberShares,
      cashPositions: p.cashPositions,
      bandFundAmount: p.bandFundAmount,
      bandFundHolderId: p.bandFundHolderId,
      absorptions: p.absorptions,
    }))
    // Manual mode has no consolidation concept — every non-self assignment
    // is a real payment, never recorded as a transaction, same as auto's
    // routed payments; only self-assignments need a fund deduction.
    const consolidations = mode === 'auto' ? consolidationAbsorptions : {}
    const selfSats = mode === 'auto' ? selfSatisfactions : manualSelfSatisfactions
    startTransition(async () => {
      const result = await splitShows(payload, consolidations, selfSats)
      if (result && 'error' in result && result.error) toast(result.error, 'error')
    })
  }

  const nameOf = (id: string) => members.find(m => m.id === id)?.name ?? 'Unknown'

  const pdfRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadReport = async () => {
    if (!pdfRef.current) return
    setIsDownloading(true)
    try {
      // Reflect whichever mode is active — the manual assignments if
      // that's what was actually decided, or the algorithm's routing.
      const activePayments = mode === 'auto' ? payments : manualPayments
      const activeSelfSatisfactions = mode === 'auto' ? selfSatisfactions : manualSelfSatisfactions
      const activeConsolidations = mode === 'auto' ? consolidationAbsorptions : {}

      const rows: SplitReportRow[] = allInvolvedIds.map(id => {
        const lines: SplitReportLine[] = (breakdownByPerson[id] ?? []).map(l => ({
          showTitle: l.showTitle,
          cut: l.entitlement,
          frontedFromBalance: l.cashPosition < 0 ? -l.cashPosition : 0,
          reimbursed: l.reimbursed,
          cashHandled: l.cashPosition > 0 ? l.cashPosition : 0,
          isBandFundHolder: l.isBandFundHolder,
          baseBandFundAmount: l.baseBandFundAmount,
          extraBandFund: l.extraBandFund,
          showNet: l.showNet,
        }))
        // Exactly the Manual mode Band Fund balances panel's own logic
        // (remainingFundFor): real overall balance minus whatever they're
        // committed to pay out — as a real payment, a self-satisfaction, or
        // a consolidation absorption. Not a projected final balance — how
        // much they still have spare, same question the panel answers.
        const paidOut = round2(activePayments.filter(p => p.from === id).reduce((s, p) => s + p.amount, 0))
        const newFundBalance = round2(
          (memberBalances[id] ?? 0) - paidOut - (activeSelfSatisfactions[id] ?? 0) - (activeConsolidations[id] ?? 0)
        )
        return {
          name: nameOf(id),
          lines,
          selfSatisfied: activeSelfSatisfactions[id] ?? 0,
          consolidationAbsorbed: activeConsolidations[id] ?? 0,
          settlementAmount: netFor(id, activePayments), // pay-out-positive: >0 pays, <0 receives
          outgoing: activePayments.filter(p => p.from === id).map(p => ({ to: nameOf(p.to), amount: p.amount })),
          incoming: activePayments.filter(p => p.to === id).map(p => ({ from: nameOf(p.from), amount: p.amount })),
          newFundBalance,
        }
      })

      // One card per show — the exact same shape as the on-screen show
      // preview (title, net, its own transactions, who's involved, and
      // each person's plain cut + the plain Band Fund %), so the report
      // reads as a full record of every show that went into this split.
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
        baseBandFundAmount: p.baseBandFundAmount,
        totalAbsorbed: p.totalAbsorbed,
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
            const showEntitlement = perShow.find(p => p.show.id === s.id)

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

                    {/* Ideal equal split preview — the plain {bandPct}/{100-bandPct} split, before any reimbursement-floor adjustment */}
                    {showEntitlement && showEntitlement.involved.length > 0 && (
                      <div className="space-y-1 border-t border-brand-100 pt-2 text-xs">
                        {showEntitlement.involved.map(id => (
                          <div key={id} className="flex items-center justify-between text-gray-600">
                            <span>{nameOf(id)}</span>
                            <span className="font-semibold tabular-nums">{fmt(showEntitlement.memberShares[id] ?? 0)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-1 text-brand-600">
                          <span>Band Fund ({bandPct}%) <span className="text-gray-400">(kept by {nameOf(showEntitlement.bandFundHolderId)})</span></span>
                          <span className="font-semibold tabular-nums">{fmt(showEntitlement.baseBandFundAmount)}</span>
                        </div>
                        {showEntitlement.totalAbsorbed > 0 && (
                          <div className="flex items-center justify-between text-brand-600">
                            <span>+ Extra Band Fund <span className="text-gray-400">(no reimbursement needed for what was fronted)</span></span>
                            <span className="font-semibold tabular-nums">{fmt(showEntitlement.totalAbsorbed)}</span>
                          </div>
                        )}
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
              const cut = cutFor(id)
              const rows = assignmentsFor(id)
              const assigned = round2(rows.reduce((s, a) => s + (a.payerId ? (a.amount || 0) : 0), 0))
              const remaining = round2(cut - assigned)

              return (
                <div key={id} className="rounded-lg bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{nameOf(id)}</span>
                    <span className="text-sm font-bold tabular-nums text-green-600">Gets {fmt(cut)}</span>
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
                <span className="text-sm font-medium text-gray-700">{nameOf(p.from)}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                <span className="text-sm font-medium text-gray-700">{nameOf(p.to)}</span>
                <span className="ml-auto text-sm font-bold text-gray-900">{fmt(p.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Complete breakdown — every number behind every payment above */}
      {peopleInSettlement.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-600">Complete breakdown</h2>
          <div className="space-y-4">
            {peopleInSettlement.map(id => {
              const lines = breakdownByPerson[id] ?? []
              // Chaining can route a payment through someone (e.g. to avoid
              // splitting a recipient's payment) — they end up with both
              // outgoing and incoming lines here, so the true net is out
              // minus in, not just the raw pooled net or one direction's sum.
              const outgoing = payments.filter(p => p.from === id)
              const incoming = payments.filter(p => p.to === id)
              const net = round2(
                outgoing.reduce((s, p) => s + p.amount, 0) - incoming.reduce((s, p) => s + p.amount, 0)
              )
              const isPayer = net > 0

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
                            <>
                              <div className="flex items-center justify-between text-brand-600">
                                <span>+ Band Fund cut (you keep it)</span>
                                <span className="tabular-nums">+{fmt(line.baseBandFundAmount)}</span>
                              </div>
                              {line.extraBandFund > 0 && (
                                <div className="flex items-center justify-between text-brand-600">
                                  <span>+ Extra Band Fund (no reimbursement was needed)</span>
                                  <span className="tabular-nums">+{fmt(line.extraBandFund)}</span>
                                </div>
                              )}
                            </>
                          )}
                          <div className="flex items-center justify-between border-t border-gray-100 pt-0.5 font-medium text-gray-700">
                            <span>Show net</span>
                            <span className={cn('tabular-nums', line.showNet >= 0 ? 'text-green-600' : 'text-red-500')}>
                              {line.showNet >= 0 ? '+' : '−'}{fmt(line.showNet)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(consolidationAbsorptions[id] ?? 0) > 0 && (
                      <div className="text-xs">
                        <div className="flex items-center justify-between pl-2 text-gray-500">
                          <span>Covered another member&apos;s share from your Band Fund</span>
                          <span className="tabular-nums">−{fmt(consolidationAbsorptions[id])}</span>
                        </div>
                      </div>
                    )}
                    {(selfSatisfactions[id] ?? 0) > 0 && (
                      <div className="text-xs">
                        <div className="flex items-center justify-between pl-2 text-gray-500">
                          <span>Covered from your own Band Fund — nothing to send</span>
                          <span className="tabular-nums">−{fmt(selfSatisfactions[id])}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2.5 text-sm font-semibold text-gray-800">
                    <span>{isPayer ? 'Total to pay out' : 'Total you’ll receive'}</span>
                    <span className="tabular-nums">{fmt(net)}</span>
                  </div>
                  <div className="mt-1.5 space-y-1">
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
  cut: number
  frontedFromBalance: number
  reimbursed: number
  cashHandled: number
  isBandFundHolder: boolean
  /** Just the plain {bandPct}% cut, before any absorbed-savings addition. */
  baseBandFundAmount: number
  /** Extra Band Fund from someone's fronted expense not needing reimbursement — 0 most of the time. */
  extraBandFund: number
  showNet: number
}

interface SplitReportRow {
  name: string
  lines: SplitReportLine[]
  selfSatisfied: number
  consolidationAbsorbed: number
  /** Pay-out-positive: >0 pays this much, <0 receives, ~0 already settled. */
  settlementAmount: number
  outgoing: { to: string; amount: number }[]
  incoming: { from: string; amount: number }[]
  /** Their Band Fund specifically, once this split is done — only ever the 20% cut (+ savings), not their cuts. This tool only tracks Band Fund; a cut is personal money and out of scope once paid out. */
  newFundBalance: number
}

interface SplitReportShow {
  showTitle: string
  net: number
  transactions: { description: string; memberName: string | null; amount: number }[]
  cuts: { name: string; cut: number }[]
  bandFundHolderName: string
  baseBandFundAmount: number
  totalAbsorbed: number
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
  const whatHappens = (n: number) => {
    if (n > 0.01) return { label: `Pays ${fmt(n)}`, color: '#dc2626' }
    if (n < -0.01) return { label: `Gets ${fmt(n)}`, color: '#16a34a' }
    return { label: 'Nothing to send', color: '#999' }
  }

  return `
    <div>
      <h1 style="font-size:20px;font-weight:bold;margin-bottom:4px;">Tarana Split Report</h1>
      <p style="color:#666;margin-bottom:4px;">${showTitles.join(', ')}</p>
      <p style="color:#666;margin-bottom:20px;font-size:12px;">Band Fund ${bandPct}% · Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <h2 style="font-size:13px;font-weight:bold;margin:0 0 8px;color:#333;">How this was worked out</h2>
      <p style="font-size:11px;color:#666;line-height:1.6;margin:0 0 20px;">
        Each show's money is split ${bandPct}% to the Band Fund and the rest equally among everyone who played it.
        Anyone who spent their own money on the show gets it back — but only the part that would've taken their own
        balance below ₹0; if their existing Band Fund already covers it, that portion just gets relabelled as their
        payout instead of new cash moving. Whoever's owed money first covers as much of it as they can from their
        own Band Fund too. Whatever's left to actually pay out gets routed through whoever holds the most Band Fund,
        so nobody's payment gets split between two different people unless it's truly unavoidable.
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
                <td style="padding:5px 10px;text-align:right;font-weight:600;color:#7c3aed;">${fmt(s.baseBandFundAmount)}</td>
              </tr>
              ${s.totalAbsorbed > 0 ? `
              <tr>
                <td style="padding:5px 10px;color:#7c3aed;">+ Extra Band Fund <span style="color:#999;">(no reimbursement was needed)</span></td>
                <td style="padding:5px 10px;text-align:right;font-weight:600;color:#7c3aed;">${fmt(s.totalAbsorbed)}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
      `).join('')}

      <h2 style="font-size:13px;font-weight:bold;margin:20px 0 8px;color:#333;">At a glance</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px;">
        <thead>
          <tr style="background:#f5f0ff;">
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #d4c8f4;">Member</th>
            <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #d4c8f4;">Cut (all shows)</th>
            <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #d4c8f4;">What happens</th>
            <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #d4c8f4;">Band Fund left</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => {
            const cell = whatHappens(r.settlementAmount)
            const cut = round2(r.lines.reduce((s, l) => s + l.cut, 0))
            return `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
              <td style="padding:6px 10px;">${r.name}</td>
              <td style="padding:6px 10px;text-align:right;font-weight:600;">${fmt(cut)}</td>
              <td style="padding:6px 10px;text-align:right;color:${cell.color};font-weight:600;">${cell.label}</td>
              <td style="padding:6px 10px;text-align:right;font-weight:600;color:#7c3aed;">${fmt(r.newFundBalance)}</td>
            </tr>
          `
          }).join('')}
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
                <div style="display:flex;justify-content:space-between;"><span>Your cut — ${bandPct}% goes to Band Fund, the rest split equally</span><span>+${fmt(l.cut)}</span></div>
                ${l.frontedFromBalance > 0 ? `<div style="display:flex;justify-content:space-between;color:#999;"><span>You paid this out of your own pocket for the show</span><span>−${fmt(l.frontedFromBalance)}</span></div>` : ''}
                ${l.reimbursed > 0 ? `<div style="display:flex;justify-content:space-between;color:#16a34a;"><span>Paid back — the part that would've dropped your balance below ₹0</span><span>+${fmt(l.reimbursed)}</span></div>` : ''}
                ${l.cashHandled > 0 ? `<div style="display:flex;justify-content:space-between;color:#dc2626;"><span>Cash you collected for the show, beyond your own cut — needs to go back</span><span>−${fmt(l.cashHandled)}</span></div>` : ''}
                ${l.isBandFundHolder ? `<div style="display:flex;justify-content:space-between;color:#7c3aed;"><span>You're holding this show's Band Fund cut</span><span>+${fmt(l.baseBandFundAmount)}</span></div>` : ''}
                ${l.isBandFundHolder && l.extraBandFund > 0 ? `<div style="display:flex;justify-content:space-between;color:#7c3aed;"><span>+ Extra Band Fund (no reimbursement was needed)</span><span>+${fmt(l.extraBandFund)}</span></div>` : ''}
                <div style="display:flex;justify-content:space-between;font-weight:600;border-top:1px solid #eee;padding-top:2px;margin-top:2px;"><span>What this show gets you, all in</span><span>${sign(l.showNet)}${fmt(l.showNet)}</span></div>
              </div>
            </div>
          `).join('')}
          ${r.consolidationAbsorbed > 0 ? `<div style="font-size:11px;color:#666;padding-left:8px;margin-bottom:4px;">You covered another member's share out of your own Band Fund, so they didn't need to send it: −${fmt(r.consolidationAbsorbed)}</div>` : ''}
          ${r.selfSatisfied > 0 ? `<div style="font-size:11px;color:#666;padding-left:8px;margin-bottom:4px;">You already held enough Band Fund to cover what you were owed, so nothing was sent to you: −${fmt(r.selfSatisfied)}</div>` : ''}
          <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:12px;border-top:1px solid #eee;padding-top:6px;margin-top:6px;">
            <span>${r.settlementAmount > 0.01 ? 'Total to pay out' : 'Total you’ll receive'}</span>
            <span>${fmt(Math.abs(r.settlementAmount))}</span>
          </div>
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
