'use client'

import { useFinanceExtras, useMoney } from '@/components/finance/FinanceSettingsContext'
import { categoryLabel } from '@/lib/finance/settings'
import { Fragment, useMemo, useState, useTransition } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AddTransactionModal } from './AddTransactionModal'
import { Chip } from '@/components/ui/Chip'
import { CountUp } from '@/components/ui/CountUp'
import { StatusPill } from '@/components/ui/StatusPill'
import { deleteTransaction } from '@/actions/finance'
import { useToast } from '@/components/ui/Toaster'
import { CREDIT_TEXT, DEBIT_TEXT } from './money'
import type { FinanceTransaction } from '@/types/finance'
import type { Show } from '@/types/shows'
import type { Budget } from '@/types/budget'
import { Select } from '@/components/ui/Select'

interface Member { id: string; name: string }
interface Props {
  transactions: FinanceTransaction[]
  members: Member[]
  shows: Show[]
  budgets?: Budget[]
  showTitleById: Record<string, string>
  runningBalances?: Record<string, { total: number; memberBalance: number | null }>
}

const fieldCls = 'compact-field rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'
const thCls = 'py-2.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-500'

interface RowProps {
  transaction: FinanceTransaction
  members: Member[]
  shows: Show[]
  budgets?: Budget[]
  payerName: string
  badge?: { label: string; kind: 'show' | 'category' }
  afterFundTotal?: number
  afterMemberBalance?: number
}

function TransactionTableRow({ transaction: t, members, shows, budgets, payerName, badge, afterFundTotal, afterMemberBalance }: RowProps) {
  const { money: fmt, signed: fmtSigned, canChangeEntries } = useMoney()
  const [editOpen, setEditOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()
  const [leaving, setLeaving] = useState(false)
  const toast = useToast()
  const isCredit = t.amount >= 0
  const dateStr = new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Delete this entry? This can’t be undone.')) return
    // The row fades out first, then the delete runs and the list refreshes without it.
    setLeaving(true)
    window.setTimeout(() => startDeleteTransition(async () => {
      const result = await deleteTransaction(t.id)
      if (result.error) { toast(result.error, 'error'); setLeaving(false) }
    }), 200)
  }

  return (
    <tr
      className={cn(
        'animate-row-in',
        canChangeEntries && 'cursor-pointer transition-colors hover:bg-brand-50',
        isDeleting && 'pointer-events-none opacity-40',
        leaving && 'animate-row-out pointer-events-none'
      )}
      onClick={() => canChangeEntries && setEditOpen(true)}
    >
      {/* Date: own column on sm+; hidden on mobile, shown in description subline */}
      <td className="hidden whitespace-nowrap py-3 pl-4 pr-3 text-[13px] text-gray-500 sm:table-cell">
        {dateStr}
      </td>
      <td className="w-full max-w-0 py-3 pl-4 pr-2 sm:w-auto sm:max-w-[260px] sm:pl-0">
        <div className="flex items-center gap-2">
          <p className="line-clamp-2 min-w-0 break-words text-[13px] font-bold leading-tight text-gray-900 sm:truncate sm:text-sm">{t.description}</p>
          {/* Desktop: badge beside the description */}
          {badge && (
            <StatusPill tone={badge.kind === 'show' ? 'green' : 'gray'} className="hidden max-w-[45%] shrink-0 truncate sm:inline-flex">
              {badge.label}
            </StatusPill>
          )}
        </div>
        {/* Mobile subline: date + member + badge */}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[11px] leading-snug text-gray-500 sm:hidden">
          <span>{dateStr}</span>
          <span>&middot;</span>
          <span>{payerName}</span>
          {badge && <span className="rounded bg-gray-100 px-1 py-0.5 font-semibold text-gray-600">{badge.label}</span>}
          {t.tags?.length > 0 && t.tags.map(tag => (
            <span key={tag} className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">#{tag}</span>
          ))}
        </p>
        {t.tags?.length > 0 && (
          <p className="mt-1 hidden flex-wrap gap-1 sm:flex">
            {t.tags.map(tag => <span key={tag} className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">#{tag}</span>)}
          </p>
        )}
      </td>
      {/* Member: own column on sm+; hidden on mobile, in subline above */}
      <td className="hidden whitespace-nowrap py-3 pr-3 text-[13px] text-gray-700 sm:table-cell">{payerName}</td>
      <td className="whitespace-nowrap py-3 pr-3 text-right">
        <span className={cn('text-[13px] font-extrabold tabular-nums sm:text-sm', isCredit ? CREDIT_TEXT : DEBIT_TEXT)}>
          {isCredit ? '+' : '−'}{fmt(t.amount)}
        </span>
      </td>
      <td className="hidden whitespace-nowrap py-3 pr-3 text-right md:table-cell">
        {afterMemberBalance !== undefined
          ? <span className={cn('text-xs font-medium tabular-nums', afterMemberBalance < 0 ? 'text-red-700' : 'text-gray-500')}>{fmtSigned(afterMemberBalance)}</span>
          : <span className="text-xs text-gray-400">-</span>}
      </td>
      <td className="whitespace-nowrap py-3 pr-2 text-right">
        {afterFundTotal !== undefined
          ? <span className={cn('text-xs font-semibold tabular-nums', afterFundTotal < 0 ? 'text-red-700' : 'text-gray-600')}>{fmtSigned(afterFundTotal)}</span>
          : <span className="text-xs text-gray-400">-</span>}
      </td>
      <td className="py-3 pl-1 pr-3" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting || !canChangeEntries}
          hidden={!canChangeEntries}
          aria-label="Delete entry"
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <div onClick={e => e.stopPropagation()}>
          <AddTransactionModal
            members={members}
            shows={shows}
            budgets={budgets}
            transaction={t}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
        </div>
      </td>
    </tr>
  )
}

const monthKey = (iso: string) => iso.slice(0, 7)
const monthLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

export function FinanceHistoryList({ transactions, members, shows, budgets, showTitleById, runningBalances }: Props) {
  const { money: fmt, signed: fmtSigned, settings: moneySettings } = useMoney()
  const [memberFilter, setMemberFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'misc' | 'show'>('all')
  const [dirFilter, setDirFilter] = useState<'all' | 'credit' | 'debit'>('all')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const { projects } = useFinanceExtras()

  // Only offer filters for categories and tags that actually appear in this list.
  const categoryKeys = [...new Set(transactions.map(t => t.category).filter((c): c is string => !!c))]
    .sort((a, b) => categoryLabel(moneySettings, a).localeCompare(categoryLabel(moneySettings, b)))
  const usedTags = [...new Set(transactions.flatMap(t => t.tags ?? []))].sort((a, b) => a.localeCompare(b))
  const usedProjects = projects.filter(p => transactions.some(t => t.project_id === p.id))

  const nameOf = (id: string | null) => id === null ? 'Unattributed' : (members.find(m => m.id === id)?.name ?? 'Unknown')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return transactions.filter(t => {
      if (memberFilter === 'fund' && t.member_id !== null) return false
      if (memberFilter !== 'all' && memberFilter !== 'fund' && t.member_id !== memberFilter) return false
      if (typeFilter === 'misc' && t.show_id) return false
      if (typeFilter === 'show' && !t.show_id) return false
      if (dirFilter === 'credit' && t.amount < 0) return false
      if (dirFilter === 'debit' && t.amount >= 0) return false
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
      if (tagFilter !== 'all' && !(t.tags ?? []).includes(tagFilter)) return false
      if (projectFilter !== 'all' && t.project_id !== projectFilter) return false
      if (q) {
        const showTitle = t.show_id ? (showTitleById[t.show_id] ?? '') : ''
        const haystack = `${t.description} ${showTitle} ${categoryLabel(moneySettings, t.category)} ${(t.tags ?? []).join(' ')}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [transactions, memberFilter, typeFilter, dirFilter, categoryFilter, tagFilter, projectFilter, query, showTitleById, moneySettings])

  const bandFundRows = filtered.filter(t => t.category !== 'reimbursement' && t.member_id)
  const total = bandFundRows.reduce((s, t) => s + t.amount, 0)
  const totalCredit = bandFundRows.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalDebit = bandFundRows.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)
  const isFiltered = memberFilter !== 'all' || typeFilter !== 'all' || dirFilter !== 'all' || categoryFilter !== 'all' || tagFilter !== 'all' || projectFilter !== 'all' || query.trim() !== ''

  return (
    <div className="space-y-4">
      {/* Totals for whatever is shown below */}
      <div className="grid grid-cols-3 divide-x divide-brand-200 rounded-2xl border border-brand-200 bg-white">
        <div className="px-4 py-3 sm:px-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-500">Money in</p>
          <p className={cn('font-display text-lg font-bold tabular-nums sm:text-2xl', CREDIT_TEXT)}><CountUp value={totalCredit} format={fmt} /></p>
        </div>
        <div className="px-4 py-3 sm:px-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-500">Money out</p>
          <p className={cn('font-display text-lg font-bold tabular-nums sm:text-2xl', DEBIT_TEXT)}><CountUp value={totalDebit} format={fmt} /></p>
        </div>
        <div className="px-4 py-3 sm:px-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-500">{isFiltered ? 'Net of these' : `${moneySettings.fundName} now`}</p>
          <p className={cn('font-display text-lg font-bold tabular-nums sm:text-2xl', total < 0 ? DEBIT_TEXT : 'text-gray-900')}>{fmtSigned(total)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          <Chip active={dirFilter === 'all'} onClick={() => setDirFilter('all')}>All</Chip>
          <Chip active={dirFilter === 'credit'} onClick={() => setDirFilter('credit')}>Money in</Chip>
          <Chip active={dirFilter === 'debit'} onClick={() => setDirFilter('debit')}>Money out</Chip>
        </div>
        <Select value={memberFilter} onChange={e => setMemberFilter(e.target.value)} className={cn(fieldCls, 'shrink-0')} aria-label="Member">
          <option value="all">Everyone</option>
          <option value="fund">Unattributed</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
        <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)} className={cn(fieldCls, 'shrink-0')} aria-label="Type">
          <option value="all">All types</option>
          <option value="misc">General</option>
          <option value="show">Shows</option>
        </Select>
        {categoryKeys.length > 0 && (
          <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className={cn(fieldCls, 'shrink-0')} aria-label="Category">
            <option value="all">All categories</option>
            {categoryKeys.map(c => <option key={c} value={c}>{categoryLabel(moneySettings, c)}</option>)}
          </Select>
        )}
        {usedTags.length > 0 && (
          <Select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className={cn(fieldCls, 'shrink-0')} aria-label="Tag">
            <option value="all">All tags</option>
            {usedTags.map(t => <option key={t} value={t}>#{t}</option>)}
          </Select>
        )}
        {moneySettings.features.projects && usedProjects.length > 0 && (
          <Select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className={cn(fieldCls, 'shrink-0')} aria-label="Project">
            <option value="all">All projects</option>
            {usedProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
        <div className="relative order-first min-w-0 basis-full sm:order-none sm:ml-auto sm:basis-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-300" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search entries…"
            className={cn(fieldCls, 'w-full pl-9')}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-brand-200 py-16 text-center text-sm text-gray-500">
          No entries match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-brand-200 bg-white">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-brand-100 bg-gray-50">
                <th className={cn(thCls, 'hidden pl-4 pr-3 sm:table-cell')}>Date</th>
                <th className={cn(thCls, 'pl-4 pr-2 sm:pl-0')}>Description</th>
                <th className={cn(thCls, 'hidden pr-3 sm:table-cell')}>Member</th>
                <th className={cn(thCls, 'pr-3 text-right')}>Amount</th>
                <th className={cn(thCls, 'hidden pr-3 text-right md:table-cell')}>Mem. bal.</th>
                <th className={cn(thCls, 'pr-2 text-right')}>Fund after</th>
                <th className="py-2.5 pl-1 pr-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {filtered.map((t, i) => {
                const showTitle = t.show_id ? showTitleById[t.show_id] : null
                const badge = showTitle
                  ? { label: showTitle, kind: 'show' as const }
                  : t.category
                    ? { label: categoryLabel(moneySettings, t.category), kind: 'category' as const }
                    : undefined
                const rb = runningBalances?.[t.id]
                const startsMonth = i === 0 || monthKey(filtered[i - 1].date) !== monthKey(t.date)
                return (
                  <Fragment key={t.id}>
                    {startsMonth && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-2 font-display text-sm font-bold text-brand-400 dark:text-emerald-400">{monthLabel(t.date)}</td>
                      </tr>
                    )}
                    <TransactionTableRow
                      transaction={t}
                      members={members}
                      shows={shows}
                      budgets={budgets}
                      payerName={nameOf(t.member_id)}
                      badge={badge}
                      afterFundTotal={rb?.total}
                      afterMemberBalance={rb?.memberBalance ?? undefined}
                    />
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
