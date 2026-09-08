'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { addTransaction, updateTransaction, addShow } from '@/actions/finance'
import { useToast } from '@/components/ui/Toaster'
import { TRANSACTION_CATEGORIES } from '@/types/finance'
import { cn } from '@/lib/utils'
import type { FinanceTransaction } from '@/types/finance'
import type { Show } from '@/types/shows'

interface Member { id: string; name: string }
interface Props {
  members: Member[]
  shows: Show[]
  /** Present = edit this transaction instead of creating a new one. */
  transaction?: FinanceTransaction
  /** Present = pin this transaction to one specific show — used for "add a missed expense" from inside that show's own review (e.g. the Split screen). Hides the Tag/Which-show pickers since both are already implied. */
  lockedShow?: { id: string; title: string }
}

const inputCls = 'w-full rounded-md border border-brand-200 bg-white px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'
const NEW_SHOW = '__new__'
const AUTO = '__auto__'

function fieldsFrom(transaction: FinanceTransaction | undefined, unsplitShows: Show[], lockedShow?: { id: string; title: string }) {
  if (!transaction) {
    return {
      tag: (lockedShow ? 'show' : null) as 'misc' | 'show' | null,
      category: TRANSACTION_CATEGORIES[0],
      showId: lockedShow?.id ?? unsplitShows[0]?.id ?? NEW_SHOW,
      memberId: AUTO,
      amount: '',
      dir: 'credit' as 'credit' | 'debit',
      description: '',
      date: new Date().toISOString().slice(0, 10),
    }
  }
  return {
    tag: (transaction.show_id ? 'show' : 'misc') as 'misc' | 'show',
    category: transaction.category ?? TRANSACTION_CATEGORIES[0],
    showId: transaction.show_id ?? (unsplitShows[0]?.id ?? NEW_SHOW),
    memberId: transaction.member_id ?? AUTO,
    amount: String(Math.abs(transaction.amount)),
    dir: (transaction.amount >= 0 ? 'credit' : 'debit') as 'credit' | 'debit',
    description: transaction.description,
    date: transaction.date,
  }
}

export function AddTransactionModal({ members, shows, transaction, lockedShow }: Props) {
  const isEdit = !!transaction
  const unsplitShows = shows.filter(s => !s.split_at)
  // Editing a transaction tagged to an already-split show still needs that
  // show in the list (just to display correctly), even though it can't be
  // picked as a destination for anything else.
  const availableShows = isEdit && transaction?.show_id && !unsplitShows.some(s => s.id === transaction.show_id)
    ? [...unsplitShows, ...shows.filter(s => s.id === transaction.show_id)]
    : unsplitShows

  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState(() => fieldsFrom(transaction, unsplitShows, lockedShow))
  const [newShowTitle, setNewShowTitle] = useState('')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const { tag, category, showId, memberId, amount, dir, description, date } = fields
  const set = <K extends keyof typeof fields>(key: K, value: typeof fields[K]) =>
    setFields(prev => ({ ...prev, [key]: value }))

  const openModal = () => {
    setFields(fieldsFrom(transaction, unsplitShows, lockedShow))
    setNewShowTitle('')
    setOpen(true)
  }

  // A category:'reimbursement' expense (fuel, parking, a personal cost for
  // the show) is always a debit, and it's meaningless without knowing who
  // it's for — the member field stops being an optional "who recorded
  // this" and becomes the one thing this form exists to capture.
  const isReimbursement = category === 'reimbursement'

  const canSubmit = tag !== null
    && !!category
    && (tag === 'misc' || showId !== NEW_SHOW || newShowTitle.trim() !== '')
    && !!amount
    && (!isReimbursement || (memberId !== AUTO && memberId !== ''))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!canSubmit || !amt || amt <= 0) return

    startTransition(async () => {
      let resolvedShowId: string | null = null

      if (tag === 'show') {
        if (showId === NEW_SHOW) {
          const showResult = await addShow({ title: newShowTitle.trim() })
          if (showResult.error || !showResult.id) {
            toast(showResult.error ?? 'Failed to create show', 'error')
            return
          }
          resolvedShowId = showResult.id
        } else {
          resolvedShowId = showId
        }
      }

      const effectiveDir = isReimbursement ? 'debit' : dir
      const payload = {
        member_id: memberId === AUTO ? null : memberId,
        amount: effectiveDir === 'credit' ? amt : -amt,
        description: description.trim() || (isReimbursement ? 'Reimbursement' : effectiveDir === 'credit' ? 'Credit' : 'Debit'),
        category,
        show_id: resolvedShowId,
        date,
      }
      const result = isEdit ? await updateTransaction(transaction.id, payload) : await addTransaction(payload)

      if (result.error) {
        toast(result.error, 'error')
      } else {
        toast(isEdit ? 'Transaction updated' : 'Transaction added', 'success')
        setOpen(false)
      }
    })
  }

  return (
    <>
      {isEdit ? (
        <button
          onClick={openModal}
          className="shrink-0 text-gray-300 opacity-0 transition-opacity hover:text-brand-500 group-hover:opacity-100"
          aria-label="Edit transaction"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : lockedShow ? (
        <Button variant="secondary" size="sm" onClick={openModal}>
          <Plus className="h-4 w-4" /> Add expense
        </Button>
      ) : (
        <Button variant="secondary" onClick={openModal}>
          <Plus className="h-4 w-4" /> Transaction
        </Button>
      )}

      <Modal open={open} onOpenChange={setOpen} title={isEdit ? 'Edit Transaction' : lockedShow ? `Add Expense — ${lockedShow.title}` : 'Record Transaction'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tag — mandatory, nothing pre-selected. Skipped entirely when
              the transaction is already pinned to one show. */}
          {!lockedShow && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Tag *</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => set('tag', 'misc')}
                  className={cn('flex-1 rounded-md py-2 text-sm font-semibold transition-colors', tag === 'misc' ? 'bg-brand-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                  Misc
                </button>
                <button type="button" onClick={() => set('tag', 'show')}
                  className={cn('flex-1 rounded-md py-2 text-sm font-semibold transition-colors', tag === 'show' ? 'bg-brand-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                  Show Related
                </button>
              </div>
            </div>
          )}

          {/* Show sub-selection: which show, with inline creation */}
          {tag === 'show' && !lockedShow && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Which show *</label>
              <select value={showId} onChange={e => set('showId', e.target.value)} className={inputCls}>
                {availableShows.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                <option value={NEW_SHOW}>+ New show…</option>
              </select>
              {showId === NEW_SHOW && (
                <input
                  type="text"
                  value={newShowTitle}
                  onChange={e => setNewShowTitle(e.target.value)}
                  placeholder="Show name, e.g. BMC"
                  className={cn(inputCls, 'mt-2')}
                  autoFocus
                />
              )}
            </div>
          )}

          {/* Sub type — mandatory once a tag is picked */}
          {tag && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Sub type *</label>
              <select value={category} onChange={e => set('category', e.target.value)} className={inputCls}>
                {TRANSACTION_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Credit / Debit — skipped for Reimbursement, which is always a
              debit: money the band owes someone back, never money in. */}
          {!isReimbursement && (
            <div className="flex gap-2">
              <button type="button" onClick={() => set('dir', 'credit')}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${dir === 'credit' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                + Credit (add money)
              </button>
              <button type="button" onClick={() => set('dir', 'debit')}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${dir === 'debit' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                − Debit (subtract)
              </button>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Amount (₹) *</label>
            <input type="number" min="0.01" step="any" value={amount} onChange={e => set('amount', e.target.value)}
              placeholder="0" className={inputCls} required />
          </div>

          {/* Reimbursement: who it's for, right up front and mandatory —
              the whole point of this category. Everyone else: the usual
              optional "who recorded this" field, further down. */}
          {isReimbursement && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Reimburse *</label>
              <select value={memberId === AUTO ? '' : memberId} onChange={e => set('memberId', e.target.value)} className={inputCls} required>
                <option value="" disabled>Who gets this back?</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                Paid back to them in full on top of their cut — never absorbed into their Band Fund balance.
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {isReimbursement ? 'What for' : 'Description *'} {isReimbursement && <span className="font-normal text-gray-400">(optional)</span>}
            </label>
            <input type="text" value={description} onChange={e => set('description', e.target.value)}
              placeholder={isReimbursement ? 'e.g. Fuel for car' : 'e.g. Rehearsal space, Sound engineer'}
              className={inputCls} required={!isReimbursement} />
          </div>

          {/* Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
            <input type="date" value={date} onChange={e => set('date', e.target.value)} className={inputCls} />
          </div>

          {/* Paid by / Received by — optional, bottom, real members only */}
          {!isReimbursement && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {dir === 'credit' ? 'Received by' : 'Paid by'} <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <select value={memberId} onChange={e => set('memberId', e.target.value)} className={inputCls}>
                <option value={AUTO}>Auto — whoever&apos;s adding this</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending} disabled={!canSubmit}>{isEdit ? 'Save' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
