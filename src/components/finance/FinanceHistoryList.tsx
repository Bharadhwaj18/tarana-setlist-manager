'use client'

import { useMemo, useState, useTransition } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AddTransactionModal } from './AddTransactionModal'
import { deleteTransaction } from '@/actions/finance'
import { useToast } from '@/components/ui/Toaster'
import type { FinanceTransaction } from '@/types/finance'
import type { Show } from '@/types/shows'

interface Member { id: string; name: string }
interface Props {
  transactions: FinanceTransaction[]
  members: Member[]
  shows: Show[]
  showTitleById: Record<string, string>
  runningBalances?: Record<string, { total: number; memberBalance: number | null }>
}

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function fmtSigned(n: number) {
  return `${n < 0 ? '−' : ''}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

const inputCls = 'rounded-md border border-brand-200 bg-white px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

interface RowProps {
  transaction: FinanceTransaction
  members: Member[]
  shows: Show[]
  payerName: string
  badge?: { label: string; kind: 'show' | 'category' }
  afterFundTotal?: number
  afterMemberBalance?: number
}

function TransactionTableRow({ transaction: t, members, shows, payerName, badge, afterFundTotal, afterMemberBalance }: RowProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()
  const toast = useToast()
  const isCredit = t.amount >= 0

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Delete this transaction? This can’t be undone.')) return
    startDeleteTransition(async () => {
      const result = await deleteTransaction(t.id)
      if (result.error) toast(result.error, 'error')
    })
  }

  return (
    <tr
      className={cn(
        'cursor-pointer transition-colors hover:bg-gray-50',
        isDeleting && 'opacity-40 pointer-events-none'
      )}
      onClick={() => setEditOpen(true)}
    >
      <td className="whitespace-nowrap py-2.5 pl-4 pr-3 text-xs text-gray-500">
        {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
      </td>
      <td className="py-2.5 pr-3 max-w-[180px]">
        <p className="truncate text-sm font-medium text-gray-800">{t.description}</p>
        {badge && (
          <span className={cn(
            'mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight',
            badge.kind === 'show' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'
          )}>
            {badge.label}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap py-2.5 pr-3 text-xs text-gray-600">{payerName}</td>
      <td className="whitespace-nowrap py-2.5 pr-3 text-right">
        <span className={cn('text-sm font-bold tabular-nums', isCredit ? 'text-green-600' : 'text-red-500')}>
          {isCredit ? '+' : '−'}{fmt(t.amount)}
        </span>
      </td>
      <td className="whitespace-nowrap py-2.5 pr-3 text-right">
        {afterMemberBalance !== undefined
          ? <span className={cn('text-xs font-medium tabular-nums', afterMemberBalance < 0 ? 'text-red-500' : 'text-gray-500')}>{fmtSigned(afterMemberBalance)}</span>
          : <span className="text-xs text-gray-300">—</span>}
      </td>
      <td className="whitespace-nowrap py-2.5 pr-3 text-right">
        {afterFundTotal !== undefined
          ? <span className={cn('text-xs font-semibold tabular-nums', afterFundTotal < 0 ? 'text-red-500' : 'text-gray-700')}>{fmtSigned(afterFundTotal)}</span>
          : <span className="text-xs text-gray-300">—</span>}
      </td>
      <td className="py-2.5 pl-2 pr-3" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label="Delete transaction"
          className="rounded-md p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <div onClick={e => e.stopPropagation()}>
          <AddTransactionModal
            members={members}
            shows={shows}
            transaction={t}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
        </div>
      </td>
    </tr>
  )
}

export function FinanceHistoryList({ transactions, members, shows, showTitleById, runningBalances }: Props) {
  const [memberFilter, setMemberFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'misc' | 'show'>('all')
  const [query, setQuery] = useState('')

  const nameOf = (id: string | null) => id === null ? 'Unattributed' : (members.find(m => m.id === id)?.name ?? 'Unknown')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return transactions.filter(t => {
      if (memberFilter === 'fund' && t.member_id !== null) return false
      if (memberFilter !== 'all' && memberFilter !== 'fund' && t.member_id !== memberFilter) return false
      if (typeFilter === 'misc' && t.show_id) return false
      if (typeFilter === 'show' && !t.show_id) return false
      if (q) {
        const showTitle = t.show_id ? (showTitleById[t.show_id] ?? '') : ''
        const haystack = `${t.description} ${showTitle} ${t.category ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [transactions, memberFilter, typeFilter, query, showTitleById])

  const total = filtered.reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-300" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search description, show…"
            className={cn(inputCls, 'w-full pl-8')}
          />
        </div>
        <select value={memberFilter} onChange={e => setMemberFilter(e.target.value)} className={inputCls}>
          <option value="all">All members</option>
          <option value="fund">Unattributed only</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)} className={inputCls}>
          <option value="all">Misc + Show</option>
          <option value="misc">Misc only</option>
          <option value="show">Show only</option>
        </select>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-2 text-sm">
        <span className="text-gray-500">{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</span>
        <span className={cn('font-bold tabular-nums', total >= 0 ? 'text-green-600' : 'text-red-500')}>
          {total >= 0 ? '+' : '−'}{fmt(total)}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          No transactions match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="py-2.5 pl-4 pr-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Date</th>
                <th className="py-2.5 pr-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Description</th>
                <th className="py-2.5 pr-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Member</th>
                <th className="py-2.5 pr-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Amount</th>
                <th className="py-2.5 pr-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Mem. Bal.</th>
                <th className="py-2.5 pr-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Fund Total</th>
                <th className="py-2.5 pl-2 pr-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(t => {
                const showTitle = t.show_id ? showTitleById[t.show_id] : null
                const badge = showTitle
                  ? { label: showTitle, kind: 'show' as const }
                  : t.category
                    ? { label: t.category, kind: 'category' as const }
                    : undefined
                const rb = runningBalances?.[t.id]
                return (
                  <TransactionTableRow
                    key={t.id}
                    transaction={t}
                    members={members}
                    shows={shows}
                    payerName={nameOf(t.member_id)}
                    badge={badge}
                    afterFundTotal={rb?.total}
                    afterMemberBalance={rb?.memberBalance ?? undefined}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
