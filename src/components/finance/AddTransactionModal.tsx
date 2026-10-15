'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { addTransaction, updateTransaction, addShow } from '@/actions/finance'
import { useToast } from '@/components/ui/Toaster'
import { activeCategories, categoryLabel, REIMBURSEMENT_KEY, type FinanceSettings } from '@/lib/finance/settings'
import { useFinanceExtras, useMoney } from '@/components/finance/FinanceSettingsContext'
import { cn } from '@/lib/utils'
import { todayISO } from '@/lib/shows'
import type { FinanceProject, FinanceTransaction } from '@/types/finance'
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
  /** Projects an entry can belong to (only offered when Projects are turned on). */
  projects?: FinanceProject[]
  /** Tags already used on entries, offered as suggestions alongside the ones in settings. */
  knownTags?: string[]
}

const inputCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'
const labelCls = 'mb-1.5 block text-xs font-bold text-gray-700'
const NEW_SHOW = '__new__'
const AUTO = '__auto__'
const NO_BUDGET = ''

const dirKey = (dir: 'credit' | 'debit') => (dir === 'credit' ? 'in' : 'out')

function firstCategory(settings: FinanceSettings, dir: 'credit' | 'debit') {
  return activeCategories(settings, dirKey(dir))[0]?.key ?? 'misc'
}

function fieldsFrom(settings: FinanceSettings, transaction: FinanceTransaction | undefined, unsplitShows: Show[], lockedShow?: { id: string; title: string }) {
  if (!transaction) {
    return {
      tag: (lockedShow ? 'show' : null) as 'misc' | 'show' | null,
      category: firstCategory(settings, 'credit'),
      showId: lockedShow?.id ?? unsplitShows[0]?.id ?? NEW_SHOW,
      memberId: AUTO,
      amount: '',
      dir: 'credit' as 'credit' | 'debit',
      description: '',
      date: todayISO(),
      budgetId: NO_BUDGET,
      tags: [] as string[],
      projectId: '',
    }
  }
  const dir = (transaction.amount >= 0 ? 'credit' : 'debit') as 'credit' | 'debit'
  return {
    tag: (transaction.show_id ? 'show' : 'misc') as 'misc' | 'show',
    // Keep whatever category is saved, even one that's since been hidden.
    category: transaction.category ?? firstCategory(settings, dir),
    showId: transaction.show_id ?? (unsplitShows[0]?.id ?? NEW_SHOW),
    memberId: transaction.member_id ?? AUTO,
    amount: String(Math.abs(transaction.amount)),
    dir,
    description: transaction.description,
    date: transaction.date,
    budgetId: transaction.budget_id ?? NO_BUDGET,
    tags: transaction.tags ?? [],
    projectId: transaction.project_id ?? '',
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

export function AddTransactionModal({ members, shows, budgets = [], transaction, lockedShow, open: controlledOpen, onOpenChange, fab, projects: projectsProp, knownTags: knownTagsProp }: Props) {
  const { settings, symbol } = useMoney()
  const extras = useFinanceExtras()
  const projects = projectsProp ?? extras.projects
  const knownTags = knownTagsProp ?? extras.knownTags
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
  const [fields, setFields] = useState(() => fieldsFrom(settings, transaction, unsplitShows, lockedShow))
  const [newShowTitle, setNewShowTitle] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const { tag, category, showId, memberId, amount, dir, description, date, budgetId, tags, projectId } = fields
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
      setFields(fieldsFrom(settings, transaction, unsplitShows, lockedShow))
      setNewShowTitle('')
      setTagDraft('')
    }
  }

  // A category:'reimbursement' expense (fuel, parking, a personal cost for
  // the show) is always a debit, and it's meaningless without knowing who
  // it's for — the member field stops being an optional "who recorded
  // this" and becomes the one thing this form exists to capture.
  const isReimbursement = category === REIMBURSEMENT_KEY

  const categoryOptions = activeCategories(settings, dirKey(dir))
  // An edited entry keeps its saved category in the list even if it's hidden or from older settings.
  const shownCategories = category && !categoryOptions.some(c => c.key === category)
    ? [...categoryOptions, { key: category, label: categoryLabel(settings, category, dirKey(dir)), direction: dirKey(dir) }]
    : categoryOptions

  const projectOptions = settings.features.projects ? projects.filter(p => !p.archived_at || p.id === transaction?.project_id) : []
  const tagSuggestions = [...new Set([...settings.tags, ...knownTags])].filter(t => !tags.includes(t)).sort((a, b) => a.localeCompare(b))
  const addTag = (raw: string) => {
    const t = raw.trim().slice(0, 40)
    if (t && !tags.includes(t) && tags.length < 10) set('tags', [...tags, t])
    setTagDraft('')
  }

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
        tags: tagDraft.trim() ? [...new Set([...tags, tagDraft.trim().slice(0, 40)])] : tags,
        project_id: projectId || null,
      }
      const result = isEdit ? await updateTransaction(transaction.id, payload) : await addTransaction(payload)

      if (result.error) {
        toast(result.error, 'error')
      } else {
        toast(isEdit ? 'Entry updated' : 'Entry added', 'success')
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
          aria-label="Edit entry"
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
          aria-label="Add money in or out"
          className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-400 text-white shadow-lg transition-colors hover:bg-brand-500 lg:hidden"
        >
          <Plus className="h-7 w-7" />
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add entry
        </Button>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={isEdit ? 'Edit entry' : lockedShow ? `Add expense — ${lockedShow.title}` : 'Add money in or out'}
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
              <SegmentButton active={dir === 'credit'} onClick={() => { set('dir', 'credit'); set('category', firstCategory(settings, 'credit')) }}>
                Money in
              </SegmentButton>
              <SegmentButton active={dir === 'debit'} onClick={() => { set('dir', 'debit'); set('category', firstCategory(settings, 'debit')) }}>
                Money out
              </SegmentButton>
            </Segmented>
          )}

          {/* Tag — mandatory, nothing pre-selected. Skipped entirely when
              the transaction is already pinned to one show. */}
          {!lockedShow && (
            <div>
              <label className={labelCls}>What is it for? *</label>
              <Segmented>
                <SegmentButton active={tag === 'misc'} onClick={() => set('tag', 'misc')}>General</SegmentButton>
                <SegmentButton active={tag === 'show'} onClick={() => set('tag', 'show')}>A show</SegmentButton>
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
              <span className="font-display text-2xl font-bold text-gray-500">{symbol}</span>
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
                Paid back to them in full on top of their cut — never taken from their {settings.fundName} balance.
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
                {shownCategories.map(c => (
                  <Chip key={c.key} active={category === c.key} onClick={() => set('category', c.key)}>{c.label}</Chip>
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

          {projectOptions.length > 0 && (
            <div>
              <label className={labelCls}>Project <span className="font-normal text-gray-500">(optional)</span></label>
              <select value={projectId} onChange={e => set('projectId', e.target.value)} className={inputCls}>
                <option value="">No project</option>
                {projectOptions.map(p => <option key={p.id} value={p.id}>{p.name}{p.archived_at ? ' (finished)' : ''}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls} htmlFor="entry-tags">Tags <span className="font-normal text-gray-500">(optional)</span></label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-2 py-1.5 focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-400">
              {tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-100 py-0.5 pl-2.5 pr-1 text-xs font-bold text-gray-800">
                  {t}
                  <button type="button" aria-label={`Remove tag ${t}`} onClick={() => set('tags', tags.filter(x => x !== t))} className="rounded-full p-0.5 hover:bg-brand-200"><X className="h-3 w-3" /></button>
                </span>
              ))}
              <input
                id="entry-tags"
                list="entry-tag-suggestions"
                value={tagDraft}
                onChange={e => setTagDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagDraft) }
                  else if (e.key === 'Backspace' && !tagDraft && tags.length > 0) set('tags', tags.slice(0, -1))
                }}
                onBlur={() => tagDraft.trim() && addTag(tagDraft)}
                placeholder={tags.length === 0 ? 'e.g. Goa tour' : ''}
                className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
              />
              <datalist id="entry-tag-suggestions">
                {tagSuggestions.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
            {tagSuggestions.length > 0 && tags.length < 10 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {tagSuggestions.slice(0, 6).map(t => (
                  <button key={t} type="button" onClick={() => addTag(t)} className="rounded-full border border-dashed border-brand-300 px-2.5 py-0.5 text-xs font-semibold text-gray-600 hover:bg-brand-50">+ {t}</button>
                ))}
              </div>
            )}
          </div>

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
            <Button type="submit" loading={isPending} disabled={!canSubmit}>{isEdit ? 'Save' : 'Save entry'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
