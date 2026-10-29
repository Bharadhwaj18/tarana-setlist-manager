'use client'

import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AddTransactionModal } from './AddTransactionModal'
import { StatusPill } from '@/components/ui/StatusPill'
import { deleteTransaction } from '@/actions/finance'
import { useToast } from '@/components/ui/Toaster'
import { CREDIT_TEXT, DEBIT_TEXT } from './money'
import type { FinanceTransaction } from '@/types/finance'
import type { Show } from '@/types/shows'
import type { Budget } from '@/types/budget'

interface Member { id: string; name: string }
interface Props {
  transaction: FinanceTransaction
  members: Member[]
  shows: Show[]
  budgets?: Budget[]
  /** Already resolved to a display string — never pass a function here, it can't cross the server/client boundary. */
  payerName: string
  badge?: { label: string; kind: 'show' | 'category' }
  /** Total band fund balance after this transaction — shown in history for easy tracking. */
  afterFundTotal?: number
  /** Paying member's band fund balance after this transaction — null if unattributed. */
  afterMemberBalance?: number
}

/**
 * A whole transaction row that opens Edit on tap — no hunting for a tiny
 * pencil icon that only ever showed up on :hover, which never fires on a
 * touchscreen. Delete stays a real, always-visible button of its own
 * (stopping the tap from also opening Edit), with a confirm before it
 * actually deletes anything, since it's no longer hover-gated as an
 * accidental safety net.
 */
export function TransactionRow({ transaction: t, members, shows, budgets, payerName, badge, afterFundTotal, afterMemberBalance }: Props) {
  const { money: fmt, signed: fmtSigned, canChangeEntries } = useMoney()
  const [editOpen, setEditOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()
  const [leaving, setLeaving] = useState(false)
  const toast = useToast()
  const isCredit = t.amount >= 0
  // A move is two linked entries: it isn't edited, only undone (which removes both).
  const isMove = !!t.transfer_id
  const canEdit = canChangeEntries && !isMove

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(isMove ? 'Undo this move? Both sides of it are removed.' : 'Delete this entry? This can’t be undone.')) return
    setLeaving(true)
    window.setTimeout(() => startDeleteTransition(async () => {
      const result = await deleteTransaction(t.id)
      if (result.error) { toast(result.error, 'error'); setLeaving(false) }
    }), 200)
  }

  return (
    <div
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onClick={() => canEdit && setEditOpen(true)}
      onKeyDown={e => {
        if (canEdit && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          setEditOpen(true)
        }
      }}
      className={cn('animate-row-in flex items-center gap-3 px-4 py-3 text-left transition-colors', canEdit && 'cursor-pointer hover:bg-brand-50', leaving && 'animate-row-out pointer-events-none')}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-gray-900">{t.description}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
          <span>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
          <span>·</span>
          <span>{payerName}</span>
          {t.tags?.length > 0 && t.tags.map(tag => (
            <span key={tag} className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">#{tag}</span>
          ))}
          {afterMemberBalance !== undefined && (
            <span className={cn('font-medium tabular-nums', afterMemberBalance < 0 ? 'text-red-700' : 'text-gray-500')}>
              {fmtSigned(afterMemberBalance)}
            </span>
          )}
        </p>
      </div>
      {badge && (
        <StatusPill tone={badge.kind === 'show' ? 'green' : 'gray'} className="hidden max-w-[40%] truncate sm:inline-flex">
          {badge.label}
        </StatusPill>
      )}
      {afterFundTotal !== undefined && (
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-gray-500">Fund total</p>
          <p className={cn('text-xs font-semibold tabular-nums', afterFundTotal < 0 ? 'text-red-700' : 'text-gray-700')}>{fmtSigned(afterFundTotal)}</p>
        </div>
      )}
      <span className={cn('shrink-0 text-sm font-extrabold tabular-nums', isCredit ? CREDIT_TEXT : DEBIT_TEXT)}>
        {isCredit ? '+' : '−'}{fmt(t.amount)}
      </span>
      {canChangeEntries && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label={isMove ? 'Undo move' : 'Delete entry'}
          className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {/* React portals still bubble clicks up the *React* tree (Radix's
          dialog included), not just the DOM tree — without this stopgap, a
          tap on "Cancel" or "Save" inside the modal would also re-fire the
          row's own onClick right after, immediately reopening it. */}
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
    </div>
  )
}
