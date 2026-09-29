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

const inputCls = 'compact-field rounded-md border border-brand-200 bg-white px-2 py-1.5 text-[11px] focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

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
  const dateStr = new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Delete this transaction? This cannot be undone.')) return
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
      {/* Date: own column on sm+; hidden on mobile, shown in description subline */}
      <td className="hidden whitespace-nowrap py-2.5 pl-4 pr-3 text-xs text-gray-500 sm:table-cell">
        {dateStr}
      </td>
      <td className="w-full max-w-0 py-2.5 pl-3 pr-2 sm:w-auto sm:max-w-[220px] sm:pl-0">
        <p className="line-clamp-2 break-words text-[13px] font-medium leading-tight text-gray-800 sm:truncate sm:text-sm">{t.description}</p>
        {/* Mobile subline: date + member + badge */}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[10px] leading-snug text-gray-400 sm:hidden">
          <span>{dateStr}</span>
          <span>&middot;</span>
          <span>{payerName}</span>
          {badge && (
            <span className={cn(
              'rounded px-1 py-0.5 font-medium',
              badge.kind === 'show' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'
            )}>
              {badge.label}
            </span>
          )}
        </p>
        {/* Desktop: badge below description */}
        {badge && (
          <span className={cn(
            'mt-0.5 hidden rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight sm:inline-block',
            badge.kind === 'show' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'
          )}>
            {badge.label}
          </span>
        )}
      </td>
      {/* Member: own column on sm+; hidden on mobile, in subline above */}
      <td className="hidden whitespace-nowrap py-2.5 pr-3 text-xs text-gray-600 sm:table-cell">{payerName}</td>
      <td className="whitespace-nowrap py-2.5 pr-2 text-right">
        <span className={cn('text-xs font-bold tabular-nums sm:text-sm', isCredit ? 'text-green-600' : 'text-red-500')}>
          {isCredit ? '+' : '-'}{fmt(t.amount)}
        </span>
      </td>
      <td className="whitespace-nowrap py-2.5 pr-2 text-right">
        {afterMemberBalance !== undefined
          ? <span className={cn('text-xs font-medium tabular-nums', afterMemberBalance < 0 ? 'text-red-500' : 'text-gray-500')}>{fmtSigned(afterMemberBalance)}</span>
          : <span className="text-xs text-gray-300">-</span>}
      </td>
      <td className="whitespace-nowrap py-2.5 pr-2 text-right">
        {afterFundTotal !== undefined
          ? <span className={cn('text-xs font-semibold tabular-nums', afterFundTotal < 0 ? 'text-red-500' : 'text-gray-700')}>{fmtSigned(afterFundTotal)}</span>
          : <span className="text-xs text-gray-300">-</span>}
      </td>
      <td className="py-2.5 pl-1 pr-2" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label="Delete transaction"
          className="rounded-md p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
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

  const bandFundRows = filtered.filter(t => t.category !== 'reimbursement' && t.member_id)
  const total = bandFundRows.reduce((s, t) => s + t.amount, 0)
  const totalCredit = bandFundRows.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalDebit = bandFundRows.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-4">
      {/* Filters: single non-wrapping row */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-300" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search..."
            className={cn(inputCls, 'w-full pl-8')}
          />
        </div>
        <select value={memberFilter} onChange={e => setMemberFilter(e.target.value)} className={cn(inputCls, 'shrink-0')}>
          <option value="all">All</option>
          <option value="fund">Unattributed</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)} className={cn(inputCls, 'shrink-0')}>
          <option value="all">All types</option>
          <option value="misc">Misc</option>
          <option value="show">Show</option>
        </select>
      </div>

      <div className="rounded-lg bg-brand-50 px-4 py-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</span>
          <span className={cn('font-bold tabular-nums', total >= 0 ? 'text-green-600' : 'text-red-500')}>
            {total >= 0 ? '+' : '-'}{fmt(total)}
          </span>
        </div>
        {(totalCredit > 0 || totalDebit < 0) && (
          <div className="mt-1 flex items-center justify-end gap-3 text-xs">
            <span className="text-green-600 tabular-nums">+{fmt(totalCredit)} credit</span>
            <span className="text-red-500 tabular-nums">-{fmt(totalDebit)} debit</span>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          No transactions match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="hidden py-2.5 pl-4 pr-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:table-cell">Date</th>
                <th className="py-2.5 pl-3 pr-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:pl-0">Description</th>
                <th className="hidden py-2.5 pr-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:table-cell">Member</th>
                <th className="py-2.5 pr-2 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Amount</th>
                <th className="py-2.5 pr-2 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Mem. Bal.</th>
                <th className="py-2.5 pr-2 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Fund Total</th>
                <th className="py-2.5 pl-1 pr-2"><span className="sr-only">Actions</span></th>
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
