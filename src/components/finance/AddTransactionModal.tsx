'use client'

import { useState, useTransition } from 'react'
import { ArrowDownLeft, ArrowUpRight, Banknote, Check, ChevronDown, Landmark, Plus, Pencil, User, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { addTransaction, updateTransaction, addShow } from '@/actions/finance'
import { useToast } from '@/components/ui/Toaster'
import { activeCategories, categoryLabel, REIMBURSEMENT_KEY, type FinanceSettings } from '@/lib/finance/settings'
import { useFinanceExtras, useMoney } from '@/components/finance/FinanceSettingsContext'
import { accountIdOf, accountValue, isAccountValue } from '@/lib/finance/accounts'
import { cn } from '@/lib/utils'
import { todayISO } from '@/lib/shows'
import type { FinanceProject, FinanceTransaction } from '@/types/finance'
import type { Show } from '@/types/shows'
import type { Budget } from '@/types/budget'
import { Select } from '@/components/ui/Select'

interface Member { id: string; name: string; isYou?: boolean }
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
  /** Start a new entry with this holder chosen (an "acct:<id>" value), e.g. from an account's own page. */
  presetHolder?: string
}

const inputCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'
const labelCls = 'mb-1.5 block text-xs font-bold text-gray-700'
const NEW_SHOW = '__new__'
const NO_SHOW = ''
const AUTO = '__auto__'
const NO_BUDGET = ''

const dirKey = (dir: 'credit' | 'debit') => (dir === 'credit' ? 'in' : 'out')

function firstCategory(settings: FinanceSettings, dir: 'credit' | 'debit') {
  return activeCategories(settings, dirKey(dir))[0]?.key ?? 'misc'
}

function fieldsFrom(settings: FinanceSettings, transaction: FinanceTransaction | undefined, lockedShow?: { id: string; title: string }, presetHolder?: string) {
  if (!transaction) {
    return {
      category: firstCategory(settings, 'credit'),
      // Empty = not for a show.
      showId: lockedShow?.id ?? NO_SHOW,
      memberId: presetHolder ?? AUTO,
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
    // Keep whatever category is saved, even one that's since been hidden.
    category: transaction.category ?? firstCategory(settings, dir),
    showId: transaction.show_id ?? NO_SHOW,
    memberId: transaction.account_id ? accountValue(transaction.account_id) : transaction.member_id ?? AUTO,
    amount: String(Math.abs(transaction.amount)),
    dir,
    description: transaction.description,
    date: transaction.date,
    budgetId: transaction.budget_id ?? NO_BUDGET,
    tags: transaction.tags ?? [],
    projectId: transaction.project_id ?? '',
  }
}

export function AddTransactionModal({ members, shows, budgets = [], transaction, lockedShow, open: controlledOpen, onOpenChange, fab, projects: projectsProp, knownTags: knownTagsProp, presetHolder }: Props) {
  const { settings, symbol, needsApproval, canApprove } = useMoney()
  const extras = useFinanceExtras()
  const projects = projectsProp ?? extras.projects
  const knownTags = knownTagsProp ?? extras.knownTags
  // Accounts this entry can go to: the active ones, plus the one it's already in (even if archived since).
  // Only admins and treasurers change what's in an account, so when editing, everyone else keeps to themselves. A new
  // entry from anyone else can still ask for an account: it waits for approval.
  const isEdit = !!transaction
  const accountChoices = settings.features.accounts && (canApprove || !isEdit) ? extras.accounts.filter(a => !a.archived || a.id === transaction?.account_id) : []
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
  const [fields, setFields] = useState(() => fieldsFrom(settings, transaction, lockedShow, presetHolder))
  const [newShowTitle, setNewShowTitle] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  // Set once the entry is saved: the form swaps for a tick, then the modal closes.
  const [saved, setSaved] = useState<string | null>(null)
  const toast = useToast()

  const { category, showId, memberId, amount, dir, description, date, budgetId, tags, projectId } = fields
  const forShow = showId !== NO_SHOW
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
      setFields(fieldsFrom(settings, transaction, lockedShow, presetHolder))
      setMoreOpen(isEdit && !!(transaction?.tags?.length || transaction?.project_id || transaction?.budget_id))
      setNewShowTitle('')
      setTagDraft('')
      setSaved(null)
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
  const showBudgetField = !forShow && dir === 'debit' && !isReimbursement && budgetOptions.length > 0

  const canSubmit = !!category
    && (showId !== NEW_SHOW || newShowTitle.trim() !== '')
    && !!amount
    && (!isReimbursement || (memberId !== AUTO && memberId !== ''))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!canSubmit || !amt || amt <= 0) return

    startTransition(async () => {
      let resolvedShowId: string | null = null

      if (forShow) {
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
        member_id: memberId === AUTO || isAccountValue(memberId) ? null : memberId,
        account_id: isReimbursement ? null : accountIdOf(memberId),
        amount: effectiveDir === 'credit' ? amt : -amt,
        description: description.trim() || (isReimbursement ? 'Reimbursement' : effectiveDir === 'credit' ? 'Credit' : 'Debit'),
        category,
        show_id: resolvedShowId,
        budget_id: !forShow && effectiveDir === 'debit' && !isReimbursement && budgetId ? budgetId : null,
        date,
        tags: tagDraft.trim() ? [...new Set([...tags, tagDraft.trim().slice(0, 40)])] : tags,
        project_id: projectId || null,
      }
      const result = isEdit ? await updateTransaction(transaction.id, payload) : await addTransaction(payload)

      if (result.error) {
        toast(result.error, 'error')
      } else {
        const message = isEdit ? 'Entry updated' : 'pending' in result && result.pending ? 'Sent for approval' : 'Entry added'
        toast(message, 'success')
        setSaved(message)
        window.setTimeout(() => setOpen(false), 900)
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
        {saved ? (
          <div role="status" className="flex flex-col items-center gap-3 py-10">
            <span className="animate-check-pop flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <Check className="h-8 w-8" strokeWidth={3} />
            </span>
            <p className="animate-fade-up text-base font-extrabold text-gray-900">{saved}</p>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {(needsApproval || (isAccountValue(memberId) && !canApprove)) && !isEdit && (
            <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm font-semibold text-amber-900">An admin or treasurer will approve this before it counts.</p>
          )}
          {/* 1. In or out — the one choice everything else follows from. */}
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'credit', title: 'Money in', hint: 'Someone paid us', icon: ArrowDownLeft },
              { value: 'debit', title: 'Money out', hint: 'We spent or paid', icon: ArrowUpRight },
            ] as const).map(o => (
              <button key={o.value} type="button" aria-pressed={dir === o.value}
                onClick={() => { if (dir !== o.value) { set('dir', o.value); set('category', firstCategory(settings, o.value)) } }}
                className={cn('flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors',
                  dir === o.value ? 'border-brand-400 bg-brand-100' : 'border-brand-200 hover:bg-brand-50')}>
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  dir === o.value ? (o.value === 'credit' ? 'bg-brand-400 text-white' : 'bg-red-600 text-white') : 'bg-brand-100 text-gray-500')}>
                  <o.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-gray-900">{o.title}</span>
                  <span className="block text-xs text-gray-500">{o.hint}</span>
                </span>
              </button>
            ))}
          </div>

          {/* 2. How much */}
          <div>
            <label htmlFor="entry-amount" className={labelCls}>How much?</label>
            <div className="flex items-center gap-2 rounded-xl border-2 border-brand-400 px-3.5 py-2">
              <span className="font-display text-2xl font-bold text-gray-500">{symbol}</span>
              <input
                id="entry-amount"
                type="number"
                inputMode="decimal"
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

          {/* 3. What was it */}
          <div>
            <label htmlFor="entry-description" className={labelCls}>
              {isReimbursement ? 'What was it for?' : dir === 'credit' ? 'What was it?' : 'What was it for?'}
              {isReimbursement && <span className="font-normal text-gray-500"> (optional)</span>}
            </label>
            <input id="entry-description" type="text" value={description} onChange={e => set('description', e.target.value)}
              placeholder={isReimbursement ? 'e.g. Fuel for the car' : dir === 'credit' ? 'e.g. Fee for the BMC gig' : 'e.g. Cab to the venue'}
              className={inputCls} required={!isReimbursement} />
          </div>

          {/* 4. What kind — always visible, one tap */}
          <div>
            <p className={labelCls}>What kind?</p>
            <div className="flex flex-wrap gap-1.5">
              {shownCategories.map(c => (
                <Chip key={c.key} active={category === c.key} onClick={() => set('category', c.key)}>{c.label}</Chip>
              ))}
            </div>
          </div>

          {/* Reimbursement: who gets it back, required — the point of this kind. */}
          {isReimbursement && (
            <div>
              <label htmlFor="entry-reimburse" className={labelCls}>Who gets this back?</label>
              <Select id="entry-reimburse" value={memberId === AUTO ? '' : memberId} onChange={e => set('memberId', e.target.value)} className={inputCls} required>
                <option value="" disabled>Choose a person</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
              <p className="mt-1 text-xs text-gray-500">
                Paid back to them in full when the show is split — never taken from their {settings.fundName} balance.
              </p>
            </div>
          )}

          {/* 5. Which show, if any — optional, defaults to none */}
          {!lockedShow && (
            <div>
              <label htmlFor="entry-show" className={labelCls}>Is it for a show? <span className="font-normal text-gray-500">(optional)</span></label>
              <Select id="entry-show" value={showId} onChange={e => set('showId', e.target.value)} className={inputCls}>
                <option value={NO_SHOW}>No, not for a show</option>
                {availableShows.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                <option value={NEW_SHOW}>+ A new show…</option>
              </Select>
              {showId === NEW_SHOW && (
                <input
                  type="text"
                  value={newShowTitle}
                  onChange={e => setNewShowTitle(e.target.value)}
                  placeholder="Show name, e.g. BMC"
                  aria-label="New show name"
                  className={cn(inputCls, 'mt-2')}
                  autoFocus
                />
              )}
              {forShow && <p className="mt-1 text-xs text-gray-500">It will be counted when that show’s money is split.</p>}
            </div>
          )}

          {/* Where the money goes: an account, me, or someone else */}
          {!isReimbursement && accountChoices.length > 0 && (() => {
            const chosen = accountChoices.find(a => memberId === accountValue(a.id))
            const someoneElse = !isAccountValue(memberId) && memberId !== AUTO
            const others = members.filter(m => !m.isYou)
            return (
              <div>
                <p className={labelCls}>{dir === 'credit' ? 'Received into' : 'Paid from'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {accountChoices.map(a => (
                    <Chip key={a.id} active={memberId === accountValue(a.id)} onClick={() => set('memberId', accountValue(a.id))}>
                      <span className="inline-flex items-center gap-1.5">{a.kind === 'cash' ? <Banknote className="h-3.5 w-3.5" /> : <Landmark className="h-3.5 w-3.5" />}{a.name}</span>
                    </Chip>
                  ))}
                  <Chip active={memberId === AUTO} onClick={() => set('memberId', AUTO)}>
                    <span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5" />Me</span>
                  </Chip>
                  {others.length > 0 && (
                    <Chip active={someoneElse} onClick={() => set('memberId', others[0].id)}>Someone else</Chip>
                  )}
                </div>
                {someoneElse && (
                  <Select id="entry-member" aria-label={dir === 'credit' ? 'Who got the money?' : 'Who paid?'} value={memberId} onChange={e => set('memberId', e.target.value)} className={cn(inputCls, 'mt-2')}>
                    {others.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                )}
                <p className="mt-1.5 text-xs text-gray-500">
                  {chosen
                    ? (dir === 'credit' ? `Goes straight into ${chosen.name}.` : `Comes straight out of ${chosen.name}. Nobody needs reimbursing.`)
                    : memberId === AUTO
                      ? (dir === 'credit' ? 'You’re holding this money for the band.' : 'You paid this yourself, so the band owes you it back.')
                      : ''}
                </p>
              </div>
            )
          })()}

          {/* 6. Who and when */}
          <div className="grid grid-cols-2 gap-3">
            {!isReimbursement && accountChoices.length === 0 && (
              <div>
                <label htmlFor="entry-member" className={labelCls}>{dir === 'credit' ? 'Who got the money?' : 'Who paid?'}</label>
                <Select id="entry-member" value={memberId} onChange={e => set('memberId', e.target.value)} className={inputCls}>
                  <option value={AUTO}>Me</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
              </div>
            )}
            <div className={cn((isReimbursement || accountChoices.length > 0) && 'col-span-2')}>
              <label htmlFor="entry-date" className={labelCls}>When?</label>
              <input id="entry-date" type="date" value={date} onChange={e => set('date', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Extras, tucked away until wanted */}
          <div className="rounded-xl border border-brand-200">
            <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen(v => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-bold text-gray-700">
              <span>
                More options
                <span className="ml-1.5 font-normal text-gray-500">
                  {[tags.length > 0 && `${tags.length} tag${tags.length === 1 ? '' : 's'}`, projectId && 'project', budgetId && 'budget'].filter(Boolean).join(' · ') || (projectOptions.length > 0 ? 'tags, project' : 'tags')}
                </span>
              </span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', moreOpen && 'rotate-180')} />
            </button>
            {moreOpen && (
              <div className="space-y-4 border-t border-brand-100 px-3 pb-3 pt-3">
                <div>
                  <label className={labelCls} htmlFor="entry-tags">Tags</label>
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
                  <p className="mt-1 text-xs text-gray-500">Your own labels, to find and total things later. Press Enter after each one.</p>
                  {tagSuggestions.length > 0 && tags.length < 10 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {tagSuggestions.slice(0, 6).map(t => (
                        <button key={t} type="button" onClick={() => addTag(t)} className="rounded-full border border-dashed border-brand-300 px-2.5 py-0.5 text-xs font-semibold text-gray-600 hover:bg-brand-50">+ {t}</button>
                      ))}
                    </div>
                  )}
                </div>

                {projectOptions.length > 0 && (
                  <div>
                    <label htmlFor="entry-project" className={labelCls}>Project</label>
                    <Select id="entry-project" value={projectId} onChange={e => set('projectId', e.target.value)} className={inputCls}>
                      <option value="">No project</option>
                      {projectOptions.map(p => <option key={p.id} value={p.id}>{p.name}{p.archived_at ? ' (finished)' : ''}</option>)}
                    </Select>
                  </div>
                )}

                {showBudgetField && (
                  <div>
                    <label htmlFor="entry-budget" className={labelCls}>Budget</label>
                    <Select id="entry-budget" value={budgetId} onChange={e => set('budgetId', e.target.value)} className={inputCls}>
                      <option value={NO_BUDGET}>No budget</option>
                      {budgetOptions.map(b => <option key={b.id} value={b.id}>{b.name}{b.status === 'closed' ? ' (closed)' : ''}</option>)}
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending} disabled={!canSubmit}>{isEdit ? 'Save' : 'Save entry'}</Button>
          </div>
        </form>
        )}
      </Modal>
    </>
  )
}
