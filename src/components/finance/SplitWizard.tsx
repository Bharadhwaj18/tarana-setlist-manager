'use client'

import { useState, useTransition, useMemo } from 'react'
import { Check, ArrowRight } from 'lucide-react'
import { splitShows, type ShowSplitInput } from '@/actions/finance'
import { computeEntitlements, computeAbsorbedAmount, computeShowSettlementNets, computeSettlementLedgerDelta, poolSettlementNets, minimizeSettlement } from '@/lib/finance/settlement'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import type { FinanceShow, FinanceTransaction } from '@/types/finance'

interface Member { id: string; name: string }
interface Props {
  shows: FinanceShow[]
  members: Member[]
  txnsByShow: Record<string, FinanceTransaction[]>
  memberBalances: Record<string, number>
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

export function SplitWizard({ shows, members, txnsByShow, memberBalances }: Props) {
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
    return selectedShows.map(show => {
      const involved = [...(involvedByShow[show.id] ?? new Set())]
      const net = netForShow(show.id)
      const { memberShares, bandFundAmount } = computeEntitlements(net, involved, bandPct)
      const cashPositions = cashPositionsFor(txnsByShow[show.id] ?? [])
      const bandFundHolderId = holderFor(txnsByShow[show.id] ?? [], members[0]?.id ?? '')

      const absorptions = involved
        .filter(id => (cashPositions[id] ?? 0) < 0)
        .map(id => {
          const fronted = -(cashPositions[id] ?? 0)
          const standing = standingBalanceBeforeBatch(id)
          return { memberId: id, amount: computeAbsorbedAmount(standing, fronted) }
        })
        .filter(a => a.amount > 0)

      const nets = computeShowSettlementNets({
        involvedMemberIds: involved,
        entitlements: memberShares,
        bandFundAmount,
        bandFundHolderId,
        cashPositions,
        absorptions: Object.fromEntries(absorptions.map(a => [a.memberId, a.amount])),
      })

      return { show, net, involved, memberShares, bandFundAmount, bandFundHolderId, cashPositions, absorptions, nets }
    })
    // netForShow/standingBalanceBeforeBatch derive purely from the args
    // already listed here, and `members` only supplies a fallback id —
    // listing the functions themselves would just churn on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShows, involvedByShow, bandPct, txnsByShow, memberBalances])

  const pooledNets = useMemo(() => poolSettlementNets(perShow.map(p => p.nets)), [perShow])
  // Each payer's current overall balance gates whether they can safely front
  // another payer's shortfall to avoid splitting a recipient's payment — see
  // minimizeSettlement / chainedSettlement.
  const payments = useMemo(() => minimizeSettlement(pooledNets, memberBalances), [pooledNets, memberBalances])

  // Every calculation behind each person's final number, show by show — the
  // full audit trail, not just the resulting payment.
  interface BreakdownLine {
    showTitle: string
    entitlement: number
    cashPosition: number
    isBandFundHolder: boolean
    bandFundAmount: number
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
        const showNet = round2(
          computeSettlementLedgerDelta(entitlement, cashPosition) - absorbed + (isBandFundHolder ? p.bandFundAmount : 0)
        )
        ;(map[id] ??= []).push({
          showTitle: p.show.title,
          entitlement,
          cashPosition,
          isBandFundHolder,
          bandFundAmount: p.bandFundAmount,
          absorbed,
          reimbursed,
          showNet,
        })
      }
    }
    return map
  }, [perShow])

  const peopleInSettlement = Object.keys(pooledNets).filter(id => Math.abs(pooledNets[id]) > 0.01)

  const totalNet = perShow.reduce((s, p) => s + p.net, 0)
  const totalBandFund = perShow.reduce((s, p) => s + p.bandFundAmount, 0)

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

  const canConfirm = perShow.length > 0 && perShow.every(p => p.involved.length > 0)

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
    startTransition(async () => {
      const result = await splitShows(payload)
      if (result && 'error' in result && result.error) toast(result.error, 'error')
    })
  }

  const nameOf = (id: string) => members.find(m => m.id === id)?.name ?? 'Unknown'

  return (
    <div className="space-y-6">
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

                    {/* Ideal equal split preview */}
                    {showEntitlement && showEntitlement.involved.length > 0 && (
                      <div className="space-y-1 border-t border-brand-100 pt-2 text-xs">
                        {showEntitlement.involved.map(id => (
                          <div key={id} className="flex items-center justify-between text-gray-600">
                            <span>{nameOf(id)}</span>
                            <span className="font-semibold tabular-nums">{fmt(showEntitlement.memberShares[id] ?? 0)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-1 text-brand-600">
                          <span>Band Fund <span className="text-gray-400">(kept by {nameOf(showEntitlement.bandFundHolderId)})</span></span>
                          <span className="font-semibold tabular-nums">{fmt(showEntitlement.bandFundAmount)}</span>
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
                              <span>Cash handled for the show (owed back)</span>
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
                            <span>Show net</span>
                            <span className={cn('tabular-nums', line.showNet >= 0 ? 'text-green-600' : 'text-red-500')}>
                              {line.showNet >= 0 ? '+' : '−'}{fmt(line.showNet)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2.5 text-sm font-semibold text-gray-800">
                    <span>{isPayer ? 'Total to pay out' : 'Total owed to you'}</span>
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

      {/* Confirm */}
      <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-green-800">
            {fmt(totalNet - totalBandFund)} to artists, {fmt(totalBandFund)} to Band Fund
          </p>
          <p className="text-xs text-green-600">from {selectedShows.length} show{selectedShows.length !== 1 ? 's' : ''} · net {fmt(totalNet)}</p>
        </div>
        <Button onClick={handleSplit} loading={isPending} disabled={!canConfirm}>
          Confirm & Split →
        </Button>
      </div>
    </div>
  )
}
