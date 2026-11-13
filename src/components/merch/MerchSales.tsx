'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { StatusPill } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/Toaster'
import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { formatDateDMY } from '@/lib/dates'
import { groupSalesByShow, saleTakings, type MerchMove, type MerchSale } from '@/lib/merch'
import { approveMerchSales, deleteMerchSale, rejectMerchSale } from '@/actions/merch'

export type SaleWithShow = MerchSale & { show: { id: string; title: string; show_date: string | null } | null }
/** `crew`: Merch crew. Named in Merch, but never picked to hold the band's money. */
export interface Person { id: string; name: string; crew?: boolean }
export interface AccountOption { id: string; name: string }

const groupTitle = (sales: SaleWithShow[]) => sales[0]?.show?.title ?? 'Not at a show'
const groupDate = (sales: SaleWithShow[]) => sales[0]?.show?.show_date ?? sales[0]?.date ?? null

function unitsOf(moves: MerchMove[], saleIds: Set<string>) {
  return moves.reduce((n, m) => (m.sale_id && saleIds.has(m.sale_id) ? n - m.qty : n), 0)
}

function paymentLine(sales: SaleWithShow[], money: (n: number) => string) {
  const cash = sales.reduce((n, s) => n + Number(s.cash_amount), 0)
  const upi = sales.reduce((n, s) => n + Number(s.upi_amount), 0)
  const card = sales.reduce((n, s) => n + Number(s.card_amount), 0)
  return [cash && `${money(cash)} cash`, upi && `${money(upi)} UPI`, card && `${money(card)} card`].filter(Boolean).join(' · ') || 'No money taken'
}

/** Sales waiting for approval, one card per show. Approvers approve the whole show at once (one Finance entry). */
export function PendingApprovals({ sales, moves, members, accounts, canApprove, userId }: {
  sales: SaleWithShow[]
  moves: MerchMove[]
  members: Person[]
  accounts: AccountOption[]
  canApprove: boolean
  userId: string
}) {
  const { money } = useMoney()
  const [approving, setApproving] = useState<SaleWithShow[] | null>(null)
  const groups = groupSalesByShow(sales.filter(s => s.status === 'pending'))
  if (!groups.length) return null

  return (
    <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
      <SectionLabel className="mb-1">Waiting for approval</SectionLabel>
      <p className="mb-3 text-xs text-gray-600">
        {canApprove ? 'Nothing goes into Finance until you approve it. Each show becomes one income entry.' : 'An admin or someone with the Merch role approves these before they go into Finance.'}
      </p>
      <div className="space-y-2">
        {groups.map(g => {
          const ids = new Set(g.sales.map(s => s.id))
          const total = g.sales.reduce((n, s) => n + saleTakings(s), 0)
          const date = groupDate(g.sales)
          return (
            <div key={g.showId ?? 'none'} className="rounded-xl bg-white px-3 py-2.5 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {g.showId ? <Link href={`/shows/${g.showId}`} className="hover:underline">{groupTitle(g.sales)}</Link> : 'Not at a show'}
                    {date && <span className="font-normal text-gray-500"> · {formatDateDMY(date)}</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {unitsOf(moves, ids)} sold · {g.sales.length} sale{g.sales.length === 1 ? '' : 's'} · {paymentLine(g.sales, money)}
                  </p>
                </div>
                <p className="text-sm font-bold tabular-nums text-gray-900">{money(total)}</p>
                {canApprove && <Button size="sm" onClick={() => setApproving(g.sales)}><Check className="h-4 w-4" />Approve</Button>}
              </div>
              <SaleRows sales={g.sales} members={members} canApprove={canApprove} userId={userId} />
            </div>
          )
        })}
      </div>
      <ApproveModal sales={approving} onClose={() => setApproving(null)} members={members} accounts={accounts} />
    </div>
  )
}

function SaleRows({ sales, members, canApprove, userId }: { sales: SaleWithShow[]; members: Person[]; canApprove: boolean; userId: string }) {
  const { money } = useMoney()
  const router = useRouter()
  const toast = useToast()
  const nameOf = (id: string | null) => members.find(m => m.id === id)?.name ?? 'Someone'

  const act = async (s: SaleWithShow) => {
    if (canApprove) {
      const reason = prompt('Why is this sale being turned down? (The person who recorded it is told.)')
      if (reason === null) return
      const res = await rejectMerchSale(s.id, reason)
      if (res.error) { toast(res.error, 'error'); return }
      toast('Sale turned down and stock put back', 'success')
    } else {
      if (!confirm('Delete this sale? Its stock goes back.')) return
      const res = await deleteMerchSale(s.id)
      if (res.error) { toast(res.error, 'error'); return }
      toast('Sale deleted', 'success')
    }
    router.refresh()
  }

  return (
    <ul className="mt-2 space-y-1 border-t border-brand-100 pt-2">
      {sales.map(s => (
        <li key={s.id} className="flex items-center gap-2 text-xs text-gray-600">
          <span className="min-w-0 flex-1 truncate">
            {money(saleTakings(s))} · {s.mode === 'count' ? 'count' : 'stall'} · recorded by {nameOf(s.created_by)}, money with {nameOf(s.held_by)}{s.notes ? ` · ${s.notes}` : ''}
          </span>
          {(canApprove || s.created_by === userId) && (
            <button type="button" onClick={() => act(s)} aria-label={canApprove ? 'Turn this sale down' : 'Delete this sale'} title={canApprove ? 'Turn down' : 'Delete'}
              className="rounded-md p-1 text-gray-500 hover:bg-brand-100 hover:text-gray-900">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function ApproveModal({ sales, onClose, members, accounts }: { sales: SaleWithShow[] | null; onClose: () => void; members: Person[]; accounts: AccountOption[] }) {
  return (
    <Modal open={!!sales} onOpenChange={open => { if (!open) onClose() }} title="Approve merch takings" description="This adds one income entry to Finance and locks these sales.">
      {sales && <ApproveForm sales={sales} onDone={onClose} members={members} accounts={accounts} />}
    </Modal>
  )
}

function ApproveForm({ sales, onDone, members: everyone, accounts }: { sales: SaleWithShow[]; onDone: () => void; members: Person[]; accounts: AccountOption[] }) {
  const members = everyone.filter(m => !m.crew)
  const { money } = useMoney()
  const router = useRouter()
  const toast = useToast()
  const firstHolder = sales.find(s => s.held_by)?.held_by ?? ''
  const holders = new Set(sales.map(s => s.held_by).filter(Boolean))
  const [to, setTo] = useState(firstHolder && members.some(m => m.id === firstHolder) ? `m:${firstHolder}` : members[0] ? `m:${members[0].id}` : '')
  const [busy, setBusy] = useState(false)
  const total = sales.reduce((n, s) => n + saleTakings(s), 0)

  const approve = async () => {
    setBusy(true)
    const res = await approveMerchSales(sales.map(s => s.id), to.startsWith('a:') ? { accountId: to.slice(2) } : { memberId: to.slice(2) })
    setBusy(false)
    if (res.error) { toast(res.error, 'error'); return }
    toast(total > 0 ? `${money(total)} added to Finance` : 'Approved', 'success')
    router.refresh()
    onDone()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-brand-50 px-4 py-3">
        <p className="text-sm text-gray-600">{groupTitle(sales)}</p>
        <p className="text-2xl font-bold tabular-nums text-gray-900">{money(total)}</p>
        <p className="text-xs text-gray-500">{paymentLine(sales, money)}</p>
      </div>
      {total > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="approve-to">Who has the money</Label>
          <Select id="approve-to" value={to} onChange={e => setTo(e.target.value)}>
            {members.map(m => <option key={m.id} value={`m:${m.id}`}>{m.name}</option>)}
            {accounts.map(a => <option key={a.id} value={`a:${a.id}`}>{a.name} (account)</option>)}
          </Select>
          {holders.size > 1 && <p className="text-xs text-amber-600">The money was with more than one person. It goes into Finance as one entry; move money in Finance if it needs splitting.</p>}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button onClick={approve} loading={busy}>Approve</Button>
      </div>
    </div>
  )
}

/** Every sale, one row per show: what sold, what came in, and whether it's in Finance yet. */
export function SalesByShow({ sales, moves }: { sales: SaleWithShow[]; moves: MerchMove[] }) {
  const { money } = useMoney()
  const [query, setQuery] = useState('')
  const groups = groupSalesByShow(sales).filter(g => !query.trim() || groupTitle(g.sales).toLowerCase().includes(query.trim().toLowerCase()))

  if (!sales.length) {
    return <p className="py-6 text-center text-sm text-gray-500">No sales yet. Use <Link href="/merch/sell" className="font-semibold text-brand-400 hover:underline">Sell</Link> at a show.</p>
  }

  return (
    <div className="space-y-3">
      {sales.length > 6 && <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a show" aria-label="Find a show" />}
      <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-sm">
        {groups.map(g => {
          const ids = new Set(g.sales.map(s => s.id))
          const pending = g.sales.filter(s => s.status === 'pending').length
          const date = groupDate(g.sales)
          return (
            <li key={g.showId ?? 'none'} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {g.showId ? <Link href={`/shows/${g.showId}`} className="hover:underline">{groupTitle(g.sales)}</Link> : 'Not at a show'}
                </p>
                <p className="text-xs text-gray-500">{date ? `${formatDateDMY(date)} · ` : ''}{unitsOf(moves, ids)} sold · {paymentLine(g.sales, money)}</p>
              </div>
              <p className="text-sm font-bold tabular-nums text-gray-900">{money(g.sales.reduce((n, s) => n + saleTakings(s), 0))}</p>
              <StatusPill tone={pending ? 'amber' : 'green'}>{pending ? `${pending} waiting` : 'In Finance'}</StatusPill>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
