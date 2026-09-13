'use client'

import { useState, useTransition } from 'react'
import { TrendingUp, TrendingDown, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AddTransactionModal } from './AddTransactionModal'
import { deleteTransaction } from '@/actions/finance'
import { useToast } from '@/components/ui/Toaster'
import type { FinanceTransaction } from '@/types/finance'
import type { Show } from '@/types/shows'

interface Member { id: string; name: string }
interface Props {
  transaction: FinanceTransaction
  members: Member[]
  shows: Show[]
  /** Already resolved to a display string — never pass a function here, it can't cross the server/client boundary. */
  payerName: string
  badge?: { label: string; kind: 'show' | 'category' }
}

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

/**
 * A whole transaction row that opens Edit on tap — no hunting for a tiny
 * pencil icon that only ever showed up on :hover, which never fires on a
 * touchscreen. Delete stays a real, always-visible button of its own
 * (stopping the tap from also opening Edit), with a confirm before it
 * actually deletes anything, since it's no longer hover-gated as an
 * accidental safety net.
 */
export function TransactionRow({ transaction: t, members, shows, payerName, badge }: Props) {
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
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditOpen(true)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setEditOpen(true)
        }
      }}
      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
    >
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', isCredit ? 'bg-green-100' : 'bg-red-100')}>
        {isCredit
          ? <TrendingUp className="h-3.5 w-3.5 text-green-600" />
          : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">{t.description}</p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-gray-400">
          <span>{payerName}</span>
          <span>·</span>
          <span>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
          {badge && (
            <span className={cn(
              'rounded px-1.5 py-0.5 font-medium',
              badge.kind === 'show' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'
            )}>
              {badge.label}
            </span>
          )}
        </p>
      </div>
      <span className={cn('shrink-0 text-sm font-bold tabular-nums', isCredit ? 'text-green-600' : 'text-red-500')}>
        {isCredit ? '+' : '−'}{fmt(t.amount)}
      </span>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label="Delete transaction"
        className="shrink-0 rounded-md p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {/* React portals still bubble clicks up the *React* tree (Radix's
          dialog included), not just the DOM tree — without this stopgap, a
          tap on "Cancel" or "Save" inside the modal would also re-fire the
          row's own onClick right after, immediately reopening it. */}
      <div onClick={e => e.stopPropagation()}>
        <AddTransactionModal
          members={members}
          shows={shows}
          transaction={t}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      </div>
    </div>
  )
}
