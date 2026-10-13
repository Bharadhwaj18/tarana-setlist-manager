'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { addTransaction, updateTransaction, addShow } from '@/actions/finance'
import { useToast } from '@/components/ui/Toaster'
import { DEBIT_CATEGORIES, CREDIT_CATEGORIES, CREDIT_CATEGORY_LABELS } from '@/types/finance'
import { cn } from '@/lib/utils'
import { todayISO } from '@/lib/shows'
import type { FinanceTransaction } from '@/types/finance'
import type { Show } from '@/types/shows'
import type { Budget } from '@/types/budget'

interface Member { id: string; name: string }
interface Props {
  members: Member[]
  shows: Show[]
  /** Budgets a Misc expense can be tagged to. Omit to hide the field. */
  budgets?: Budget[]
  /** Present = edit this transaction instead of creating a new one. */
  transaction?: FinanceTransaction
  /** Present = pin this transaction to one specific show — used for "add a missed expense" from inside that show's own review (e.g. the Split screen). Hides the Tag/Which-show pickers since both are already implied. */
  lockedShow?: { id: string; title: string }
  /** Controlled visibility — pass both to drive this from outside (e.g. a whole tappable row opening it) instead of the built-in pencil trigger, which is skipped entirely when these are provided. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Render the trigger as a round floating button above the phone tab bar (hidden on desktop). */
  fab?: boolean
}

const inputCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'
const labelCls = 'mb-1.5 block text-xs font-bold text-gray-700'
const NEW_SHOW = '__new__'
const AUTO = '__auto__'
const NO_BUDGET = ''

function categoryLabel(dir: 'credit' | 'debit', c: string) {
  return dir === 'credit' ? (CREDIT_CATEGORY_LABELS[c as keyof typeof CREDIT_CATEGORY_LABELS] ?? c) : c.charAt(0).toUpperCase() + c.slice(1)
}

function fieldsFrom(transaction: FinanceTransaction | undefined, unsplitShows: Show[], lockedShow?: { id: string; title: string }) {
  if (!transaction) {
    return {
      tag: (lockedShow ? 'show' : null) as 'misc' | 'show' | null,
      category: CREDIT_CATEGORIES[0] as string,
      showId: lockedShow?.id ?? unsplitShows[0]?.id ?? NEW_SHOW,
      memberId: AUTO,
      amount: '',
      dir: 'credit' as 'credit' | 'debit',
      description: '',
      date: todayISO(),
      budgetId: NO_BUDGET,
    }
  }
  const dir = (transaction.amount >= 0 ? 'credit' : 'debit') as 'credit' | 'debit'
  const categories = dir === 'credit' ? CREDIT_CATEGORIES : DEBIT_CATEGORIES
  return {
    tag: (transaction.show_id ? 'show' : 'misc') as 'misc' | 'show',
    category: (transaction.category && (categories as readonly string[]).includes(transaction.category)) ? transaction.category : categories[0],
    showId: transaction.show_id ?? (unsplitShows[0]?.id ?? NEW_SHOW),
    memberId: transaction.member_id ?? AUTO,
    amount: String(Math.abs(transaction.amount)),
    dir,
    description: transaction.description,
    date: transaction.date,
    budgetId: transaction.budget_id ?? NO_BUDGET,
  }
}

function Segmented({ children }: { children: React.ReactNode }) {
  return <div className="flex rounded-xl bg-brand-100 p-1">{children}</div>
}

function SegmentButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex-1 rounded-lg px-2 py-2 text-sm font-bold transition-colors', active ? 'bg-brand-400 text-white shadow-sm' : 'text-gray-700 hover:text-gray-900')}
    >
      {children}
    </button>
  )
}

export function AddTransactionModal({ members, shows, budgets = [], transaction, lockedShow, open: controlledOpen, onOpenChange, fab }: Props) {
  const isEdit = !!transaction
  const isControlled = controlledOpen !== undefined && onOpenChange !== undefined
  const unsplitShows = shows.filter(s => !s.split_at)
  // Editing a transaction tagged to an already-split show still needs that
  // show in the list (just to display correctly), even though it can't be
  // picked as a destination for anything else.
  const availableShows = isEdit && transaction?.show_id && !unsplitShows.some(s => s.id === transaction.show_id)
    ? [...unsplitShows, ...shows.filter(s => s.id === transaction.show_id)]
    : unsplitShows

  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange : setInternalOpen
  const [fields, setFields] = useState(() => fieldsFrom(transaction, unsplitShows, lockedShow))
  const [newShowTitle, setNewShowTitle] = useState('')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const { tag, category, showId, memberId, amount, dir, description, date, budgetId } = fields
  const set = <K extends keyof typeof fields>(key: K, value: typeof fields[K]) =>
    setFields(prev => ({ ...prev, [key]: value }))

  // Reset the form fresh every time the modal opens — whether that's the
  // built-in trigger below or a parent driving `open` directly (a tappable
  // row), the reset needs to happen either way. Adjusting state during
  // render (React's documented pattern for "reset state when a prop
  // changes") rather than in an effect — it takes one extra render instead
  // of a post-commit effect pass, and never risks running before the
  // fields actually get used.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setFields(fieldsFrom(transaction, unsplitShows, lockedShow))
      setNewShowTitle('')
    }
  }

  // A category:'reimbursement' expense (fuel, parking, a personal cost for
  // the show) is always a debit, and it's meaningless without knowing who
  // it's for — the member field stops being an optional "who recorded
  // this" and becomes the one thing this form exists to capture.
  const isReimbursement = category === 'reimbursement'

  // Only Misc debits can be tagged to a budget. Editing keeps a closed budget selectable if it's already the one attached.
  const budgetOptions = budgets.filter(b => b.status === 'active' || b.id === transaction?.budget_id)
  const showBudgetField = tag === 'misc' && dir === 'debit' && !isReimbursement && budgetOptions.length > 0

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
        budget_id: tag === 'misc' && effectiveDir === 'debit' && !isReimbursement && budgetId ? budgetId : null,
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
      {isControlled ? null : isEdit ? (
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-brand-50 hover:text-brand-500"
          aria-label="Edit transaction"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : lockedShow ? (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add expense
        </Button>
      ) : fab ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Add transaction"
          className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-400 text-white shadow-lg transition-colors hover:bg-brand-500 lg:hidden"
        >
          <Plus className="h-7 w-7" />
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add transaction
        </Button>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={isEdit ? 'Edit transaction' : lockedShow ? `Add expense — ${lockedShow.title}` : 'Add transaction'}
        className="max-w-[480px] rounded-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Credit / Debit — skipped for Reimbursement, which is always a
              debit: money the band owes someone back, never money in.
              Switching direction resets Sub type to that direction's own
              first option — travel/food/etc. and show_fee/sponsorship/etc.
              are different lists, a stale pick from the other one wouldn't
              be valid. */}
          {!isReimbursement && (
            <Segmented>
              <SegmentButton active={dir === 'credit'} onClick={() => { set('dir', 'credit'); set('category', CREDIT_CATEGORIES[0]) }}>
                Credit · money in
              </SegmentButton>
              <SegmentButton active={dir === 'debit'} onClick={() => { set('dir', 'debit'); set('category', DEBIT_CATEGORIES[0]) }}>
                Debit · money out
              </SegmentButton>
            </Segmented>
          )}

          {/* Tag — mandatory, nothing pre-selected. Skipped entirely when
              the transaction is already pinned to one show. */}
          {!lockedShow && (
            <div>
              <label className={labelCls}>Tag *</label>
              <Segmented>
                <SegmentButton active={tag === 'misc'} onClick={() => set('tag', 'misc')}>Misc</SegmentButton>
                <SegmentButton active={tag === 'show'} onClick={() => set('tag', 'show')}>Show related</SegmentButton>
              </Segmented>
            </div>
          )}

          {/* Show sub-selection: which show, with inline creation */}
          {tag === 'show' && !lockedShow && (
            <div>
              <label className={labelCls}>Which show *</label>
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

          {/* Amount */}
          <div>
            <label className={labelCls}>Amount *</label>
            <div className="flex items-center gap-2 rounded-xl border-2 border-brand-400 px-3.5 py-2">
              <span className="font-display text-2xl font-bold text-gray-500">₹</span>
              <input
                type="number"
                min="0.01"
                step="any"
                value={amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="0"
                className="compact-field w-full bg-transparent font-display text-2xl font-bold tabular-nums text-gray-900 placeholder-gray-400 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Reimbursement: who it's for, right up front and mandatory —
              the whole point of this category. Everyone else: the usual
              optional "who recorded this" field, further down. */}
          {isReimbursement && (
            <div>
              <label className={labelCls}>Reimburse *</label>
              <select value={memberId === AUTO ? '' : memberId} onChange={e => set('memberId', e.target.value)} className={inputCls} required>
                <option value="" disabled>Who gets this back?</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Paid back to them in full on top of their cut — never absorbed into their Band Fund balance.
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className={labelCls}>
              {isReimbursement ? 'What for' : 'Description *'} {isReimbursement && <span className="font-normal text-gray-500">(optional)</span>}
            </label>
            <input type="text" value={description} onChange={e => set('description', e.target.value)}
              placeholder={isReimbursement ? 'e.g. Fuel for car' : 'e.g. Rehearsal space, Sound engineer'}
              className={inputCls} required={!isReimbursement} />
          </div>

          {/* Sub type — mandatory once a tag is picked; the option list
              follows whichever direction is currently selected. */}
          {tag && (
            <div>
              <label className={labelCls}>Category *</label>
              <div className="flex flex-wrap gap-1.5">
                {(dir === 'credit' ? CREDIT_CATEGORIES : DEBIT_CATEGORIES).map(c => (
                  <Chip key={c} active={category === c} onClick={() => set('category', c)}>{categoryLabel(dir, c)}</Chip>
                ))}
              </div>
            </div>
          )}

          {showBudgetField && (
            <div>
              <label className={labelCls}>
                Budget <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <select value={budgetId} onChange={e => set('budgetId', e.target.value)} className={inputCls}>
                <option value={NO_BUDGET}>No budget</option>
                {budgetOptions.map(b => <option key={b.id} value={b.id}>{b.name}{b.status === 'closed' ? ' (closed)' : ''}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" value={date} onChange={e => set('date', e.target.value)} className={inputCls} />
            </div>

            {/* Paid by / Received by — optional, real members only */}
            {!isReimbursement && (
              <div>
                <label className={labelCls}>{dir === 'credit' ? 'Received by' : 'Paid by'}</label>
                <select value={memberId} onChange={e => set('memberId', e.target.value)} className={inputCls}>
                  <option value={AUTO}>Auto (whoever&apos;s adding)</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending} disabled={!canSubmit}>{isEdit ? 'Save' : 'Save transaction'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
