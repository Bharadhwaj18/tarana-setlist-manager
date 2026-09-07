'use client'

import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AddTransactionModal } from './AddTransactionModal'
import { DeleteTransactionButton } from './DeleteTransactionButton'
import type { FinanceTransaction } from '@/types/finance'
import type { Show } from '@/types/shows'

interface Member { id: string; name: string }
interface Props {
  transactions: FinanceTransaction[]
  members: Member[]
  shows: Show[]
  showTitleById: Record<string, string>
}

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

const inputCls = 'rounded-md border border-brand-200 bg-white px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

export function FinanceHistoryList({ transactions, members, shows, showTitleById }: Props) {
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

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          No transactions match these filters.
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(t => {
            const isCredit = t.amount >= 0
            const showTitle = t.show_id ? showTitleById[t.show_id] : null
            return (
              <div key={t.id} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50">
                <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', isCredit ? 'bg-green-100' : 'bg-red-100')}>
                  {isCredit
                    ? <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{t.description}</p>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-gray-400">
                    <span>{nameOf(t.member_id)}</span>
                    <span>·</span>
                    <span>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                    {showTitle && <span className="rounded bg-brand-100 px-1.5 py-0.5 font-medium text-brand-700">{showTitle}</span>}
                    {!showTitle && t.category && <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-500">{t.category}</span>}
                  </p>
                </div>
                <span className={cn('shrink-0 text-sm font-bold tabular-nums', isCredit ? 'text-green-600' : 'text-red-500')}>
                  {isCredit ? '+' : '−'}{fmt(t.amount)}
                </span>
                <AddTransactionModal members={members} shows={shows} transaction={t} />
                <DeleteTransactionButton id={t.id} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
