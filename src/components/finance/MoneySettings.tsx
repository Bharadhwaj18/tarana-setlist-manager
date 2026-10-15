'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, Minus, Plus, Trash2 } from 'lucide-react'
import { renameFinanceTag, saveFinanceSettings } from '@/actions/finance-settings'
import { computeEntitlements } from '@/lib/finance/settlement'
import {
  CURRENCIES, formatMoney, isLockedCategory, newCategoryKey,
  type FinanceCategory, type FinanceFeatures, type FinanceSettings, type MoneyDirection,
} from '@/lib/finance/settings'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'

interface Member { id: string; name: string }

interface Props {
  initial: FinanceSettings
  members: Member[]
  canEdit: boolean
  /** Tags already on entries, listed alongside the saved ones. */
  usedTags?: string[]
}

const card = 'rounded-2xl border border-brand-200 bg-white p-5 shadow-sm'
const heading = 'font-sans text-base font-bold text-gray-900'
const help = 'mt-1 text-sm text-gray-500'
const label = 'mb-1.5 block text-sm font-bold text-gray-800'
const select = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:bg-gray-50'

const FEATURES: { key: keyof FinanceFeatures; title: string; text: string }[] = [
  { key: 'projects', title: 'Projects and tours', text: 'Group money under a tour, an album or any project, with its own budget and totals.' },
  { key: 'recurring', title: 'Repeating entries', text: 'Rent, retainers, subscriptions: set them once and they are added every week, month or year.' },
  { key: 'receivables', title: 'Waiting to be paid', text: 'A list of past shows whose fee hasn’t come in yet, so nothing slips.' },
  { key: 'tds', title: 'Tax deducted at source (TDS)', text: 'Extra fields on shows for tax the client keeps back. Turn off if it doesn’t apply to you.' },
]

function Toggle({ on, onChange, disabled, label: name }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={name}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', on ? 'bg-brand-400' : 'bg-gray-300')}
    >
      <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', on ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  )
}

export function MoneySettings({ initial, members, canEdit, usedTags = [] }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [s, setS] = useState<FinanceSettings>(initial)
  const [pending, startTransition] = useTransition()
  const [newCategory, setNewCategory] = useState<Record<MoneyDirection, string>>({ in: '', out: '' })
  const [newTag, setNewTag] = useState('')

  const dirty = JSON.stringify(s) !== JSON.stringify(initial)
  const allTags = [...new Set([...s.tags, ...usedTags])].sort((a, b) => a.localeCompare(b))
  const set = <K extends keyof FinanceSettings>(key: K, value: FinanceSettings[K]) => setS(prev => ({ ...prev, [key]: value }))
  const money = (n: number) => formatMoney(n, s.currency)
  const nameOf = (id: string) => members.find(m => m.id === id)?.name ?? 'Former member'

  const cutTotal = s.cuts.reduce((sum, c) => sum + c.percent, 0)
  const problems: string[] = []
  if (!s.fundName.trim()) problems.push('Give the shared money a name.')
  if (cutTotal + s.fundPercent > 100) problems.push('Cuts and the shared money add up to more than 100%.')
  if (s.cuts.some(c => !c.memberId)) problems.push('Choose who gets each cut.')
  if (s.cuts.some(c => !c.label.trim())) problems.push('Give each cut a name.')

  // A worked example, so the effect of every choice is visible before saving.
  const example = useMemo(() => {
    const ids = members.map(m => m.id)
    const weights = s.shareMode === 'shares' ? Object.fromEntries(ids.map(id => [id, s.shares[id] ?? 1])) : {}
    return computeEntitlements(10000, ids, s.fundPercent, {}, { weights, cuts: s.cuts.filter(c => c.memberId) })
  }, [members, s.fundPercent, s.shareMode, s.shares, s.cuts])

  const save = () => {
    if (problems.length > 0) { toast(problems[0], 'error'); return }
    startTransition(async () => {
      const res = await saveFinanceSettings(s)
      if (res.error) { toast(res.error, 'error'); return }
      toast('Money settings saved', 'success')
      router.refresh()
    })
  }

  const updateCategory = (c: FinanceCategory, patch: Partial<FinanceCategory>) =>
    set('categories', s.categories.map(x => (x.key === c.key && x.direction === c.direction ? { ...x, ...patch } : x)))
  const removeCategory = (c: FinanceCategory) =>
    set('categories', s.categories.filter(x => !(x.key === c.key && x.direction === c.direction)))
  const addCategory = (direction: MoneyDirection) => {
    const text = newCategory[direction].trim()
    if (!text) return
    if (s.categories.some(c => c.direction === direction && c.label.toLowerCase() === text.toLowerCase())) {
      toast('That category already exists.', 'error')
      return
    }
    const key = newCategoryKey(text, s.categories.filter(c => c.direction === direction))
    set('categories', [...s.categories, { key, label: text.slice(0, 40), direction }])
    setNewCategory(prev => ({ ...prev, [direction]: '' }))
  }

  const addTag = () => {
    const t = newTag.trim().slice(0, 40)
    if (!t || s.tags.includes(t)) { setNewTag(''); return }
    set('tags', [...s.tags, t])
    setNewTag('')
  }
  const renameTag = (tag: string) => {
    const next = window.prompt(`Rename “${tag}” on every entry to:`, tag)?.trim()
    if (!next || next === tag) return
    startTransition(async () => {
      const res = await renameFinanceTag(tag, next)
      if (res.error) { toast(res.error, 'error'); return }
      const tags = [...new Set([...s.tags.filter(t => t !== tag), next])]
      setS(prev => ({ ...prev, tags }))
      const saved = await saveFinanceSettings({ ...s, tags })
      if (saved.error) toast(saved.error, 'error')
      else { toast('Tag renamed everywhere', 'success'); router.refresh() }
    })
  }
  const deleteTag = (tag: string) => {
    if (!window.confirm(`Remove the tag “${tag}” from every entry? The entries themselves stay.`)) return
    startTransition(async () => {
      const res = await renameFinanceTag(tag, null)
      if (res.error) { toast(res.error, 'error'); return }
      const tags = s.tags.filter(t => t !== tag)
      setS(prev => ({ ...prev, tags }))
      const saved = await saveFinanceSettings({ ...s, tags })
      if (saved.error) toast(saved.error, 'error')
      else { toast('Tag removed', 'success'); router.refresh() }
    })
  }

  return (
    <div className="space-y-5 pb-24">
      {!canEdit && (
        <p className="rounded-xl bg-brand-100 px-4 py-3 text-sm text-gray-700">Only an admin can change these. You can see how money is set up here.</p>
      )}

      {/* Basics */}
      <section className={card}>
        <h2 className={heading}>The basics</h2>
        <p className={help}>What the shared money is called and which currency you work in.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="fund-name" className={label}>Name for the shared money</label>
            <Input id="fund-name" value={s.fundName} maxLength={40} disabled={!canEdit} onChange={e => set('fundName', e.target.value)} placeholder="Band Fund" />
            <p className="mt-1 text-xs text-gray-500">For example Band Fund, Kitty or Group pot.</p>
          </div>
          <div>
            <label htmlFor="currency" className={label}>Currency</label>
            <select id="currency" className={select} value={s.currency} disabled={!canEdit} onChange={e => set('currency', e.target.value as FinanceSettings['currency'])}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-gray-500">Only changes how amounts are shown. Nothing is converted.</p>
          </div>
        </div>
      </section>

      {/* Sharing */}
      <section className={card}>
        <h2 className={heading}>How show money is shared</h2>
        <p className={help}>Used every time you split a show. You can still change the {s.fundName} share on each split.</p>

        <div className="mt-5 space-y-6">
          <div>
            <p className={label}>1. Take anything off the top first?</p>
            <p className="-mt-1 mb-2 text-xs text-gray-500">For example a manager who gets 10% of every show before anything else. Only taken when a show makes money.</p>
            <div className="space-y-2">
              {s.cuts.map((c, i) => (
                <div key={c.id} className="grid grid-cols-[1fr_1fr_88px_36px] items-center gap-2">
                  <Input aria-label="What is this cut for" value={c.label} maxLength={40} disabled={!canEdit} placeholder="Manager"
                    onChange={e => set('cuts', s.cuts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <select aria-label="Who gets it" className={select} value={c.memberId} disabled={!canEdit}
                    onChange={e => set('cuts', s.cuts.map((x, j) => (j === i ? { ...x, memberId: e.target.value } : x)))}>
                    <option value="">Who gets it?</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <div className="relative">
                    <Input aria-label="Percent" type="number" min={0} max={100} step="any" value={c.percent} disabled={!canEdit} className="pr-7"
                      onChange={e => set('cuts', s.cuts.map((x, j) => (j === i ? { ...x, percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : x)))} />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
                  </div>
                  <button type="button" aria-label="Remove this cut" disabled={!canEdit} onClick={() => set('cuts', s.cuts.filter((_, j) => j !== i))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {canEdit && (
                <Button type="button" variant="secondary" size="sm" onClick={() => set('cuts', [...s.cuts, { id: `cut-${Date.now()}`, label: '', memberId: '', percent: 10 }])}>
                  <Plus className="mr-1 h-4 w-4" /> Add a cut
                </Button>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="fund-pct" className={label}>2. How much goes to the {s.fundName}?</label>
            <div className="flex items-center gap-3">
              <input id="fund-pct" type="range" min={0} max={100} step={5} value={s.fundPercent} disabled={!canEdit}
                onChange={e => set('fundPercent', Number(e.target.value))} className="w-full accent-brand-500" />
              <span className="w-14 shrink-0 text-right font-display text-xl font-bold text-gray-900">{s.fundPercent}%</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">Kept aside for shared costs like gear, travel or the next recording. 0% if you share everything.</p>
          </div>

          <div>
            <p className={label}>3. How is the rest shared among the people who played?</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { value: 'equal', title: 'Equally', text: 'Everyone who played gets the same.' },
                { value: 'shares', title: 'By shares', text: 'Some people get more, e.g. 2 shares vs 1.' },
              ] as const).map(o => (
                <button key={o.value} type="button" disabled={!canEdit} onClick={() => set('shareMode', o.value)} aria-pressed={s.shareMode === o.value}
                  className={cn('rounded-xl border p-3 text-left transition-colors disabled:cursor-default', s.shareMode === o.value ? 'border-brand-400 bg-brand-100' : 'border-brand-200 hover:bg-brand-50')}>
                  <span className="block text-sm font-bold text-gray-900">{o.title}</span>
                  <span className="block text-xs text-gray-500">{o.text}</span>
                </button>
              ))}
            </div>
            {s.shareMode === 'shares' && (
              <ul className="mt-3 divide-y divide-brand-100 rounded-xl border border-brand-200">
                {members.map(m => {
                  const n = s.shares[m.id] ?? 1
                  const change = (v: number) => set('shares', { ...s.shares, [m.id]: Math.max(0, Math.min(100, Math.round(v * 2) / 2)) })
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="text-sm text-gray-900">{m.name}</span>
                      <span className="flex items-center gap-1">
                        <button type="button" aria-label={`Fewer shares for ${m.name}`} disabled={!canEdit || n <= 0} onClick={() => change(n - 0.5)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-gray-700 hover:bg-brand-200 disabled:opacity-40"><Minus className="h-4 w-4" /></button>
                        <span className="w-16 text-center text-sm font-bold text-gray-900">{n} {n === 1 ? 'share' : 'shares'}</span>
                        <button type="button" aria-label={`More shares for ${m.name}`} disabled={!canEdit} onClick={() => change(n + 0.5)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-gray-700 hover:bg-brand-200 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="rounded-xl bg-brand-50 p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-gray-500">Example: a show that makes {money(10000)}, everyone played</p>
            <ul className="mt-2 space-y-1 text-sm">
              {Object.entries(example.cutShares).map(([id, amount]) => (
                <li key={`cut-${id}`} className="flex justify-between gap-3"><span className="text-gray-700">{s.cuts.filter(c => c.memberId === id).map(c => c.label || 'Cut').join(', ')} ({nameOf(id)}), first</span><span className="font-bold text-gray-900">{money(amount)}</span></li>
              ))}
              <li className="flex justify-between gap-3"><span className="text-gray-700">{s.fundName}</span><span className="font-bold text-gray-900">{money(example.bandFundAmount)}</span></li>
              {members.map(m => (
                <li key={m.id} className="flex justify-between gap-3">
                  <span className="text-gray-700">{m.name}</span>
                  <span className="font-bold text-gray-900">{money((example.memberShares[m.id] ?? 0) - (example.cutShares[m.id] ?? 0))}</span>
                </li>
              ))}
            </ul>
            {problems.length > 0 && <p className="mt-2 text-sm font-semibold text-red-700">{problems[0]}</p>}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className={card}>
        <h2 className={heading}>Categories</h2>
        <p className={help}>The labels you pick when adding money in or out. Rename them to your own words, hide or delete ones you never use, or add new ones.</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {(['in', 'out'] as const).map(direction => (
            <div key={direction}>
              <p className={label}>{direction === 'in' ? 'Money in' : 'Money out'}</p>
              <ul className="space-y-1.5">
                {s.categories.filter(c => c.direction === direction).map(c => {
                  const locked = isLockedCategory(c)
                  const isNew = !initial.categories.some(x => x.key === c.key && x.direction === c.direction)
                  return (
                    <li key={`${c.direction}:${c.key}`} className="flex items-center gap-2">
                      <Input aria-label="Category name" value={c.label} maxLength={40} disabled={!canEdit} className={cn(c.hidden && 'text-gray-400 line-through')}
                        onChange={e => updateCategory(c, { label: e.target.value })} />
                      {locked ? (
                        <>
                          <span aria-hidden="true" className="h-9 w-9 shrink-0" />
                          <span title={c.key === 'reimbursement' ? 'Always paid back in full when a show is split' : 'The fallback category'} className="flex h-9 w-9 shrink-0 items-center justify-center text-gray-400">
                            <Lock className="h-4 w-4" />
                          </span>
                        </>
                      ) : (
                        <>
                          {isNew ? <span aria-hidden="true" className="h-9 w-9 shrink-0" /> : (
                            <button type="button" aria-label={c.hidden ? 'Show this category' : 'Hide this category'} title={c.hidden ? 'Hidden: not offered for new entries' : 'Hide from new entries'} disabled={!canEdit}
                              onClick={() => updateCategory(c, { hidden: !c.hidden })}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-brand-100 disabled:opacity-40">
                              {c.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          )}
                          <button type="button" aria-label={`Delete category ${c.label}`} title="Delete" disabled={!canEdit}
                            onClick={() => {
                              if (isNew || window.confirm(`Delete “${c.label}”? Entries already in it keep the name and still show in reports, but it can’t be picked for new ones.`)) removeCategory(c)
                            }}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
              {canEdit && (
                <form className="mt-2 flex gap-2" onSubmit={e => { e.preventDefault(); addCategory(direction) }}>
                  <Input aria-label={`New ${direction === 'in' ? 'money in' : 'money out'} category`} value={newCategory[direction]} maxLength={40}
                    placeholder={direction === 'in' ? 'e.g. Streaming royalties' : 'e.g. Rehearsal studio'}
                    onChange={e => setNewCategory(prev => ({ ...prev, [direction]: e.target.value }))} />
                  <Button type="submit" variant="secondary" size="sm" disabled={!newCategory[direction].trim()}><Plus className="h-4 w-4" /></Button>
                </form>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500"><Lock className="h-3.5 w-3.5" /> Locked categories can be renamed but not deleted. Reimbursement is always paid back in full when a show is split. Deleting a category doesn’t touch entries already in it.</p>
      </section>

      {/* Tags */}
      <section className={card}>
        <h2 className={heading}>Tags</h2>
        <p className={help}>Extra labels you can put on any entry, as many as you like, e.g. “Goa tour” or “New drum kit”. Reports can total money by tag.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {allTags.length === 0 && <p className="text-sm text-gray-500">No tags yet. Add one here or while adding an entry.</p>}
          {allTags.map(t => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-100 py-1 pl-3 pr-1 text-sm font-semibold text-gray-800">
              {t}
              {canEdit && (
                <>
                  <button type="button" onClick={() => renameTag(t)} disabled={pending} className="rounded-full px-1.5 text-xs font-bold text-brand-700 hover:bg-brand-200">Rename</button>
                  <button type="button" aria-label={`Remove tag ${t}`} onClick={() => deleteTag(t)} disabled={pending} className="rounded-full p-1 text-gray-500 hover:bg-red-100 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </>
              )}
            </span>
          ))}
        </div>
        {canEdit && (
          <form className="mt-3 flex max-w-sm gap-2" onSubmit={e => { e.preventDefault(); addTag() }}>
            <Input aria-label="New tag" value={newTag} maxLength={40} placeholder="New tag" onChange={e => setNewTag(e.target.value)} />
            <Button type="submit" variant="secondary" size="sm" disabled={!newTag.trim()}><Plus className="h-4 w-4" /></Button>
          </form>
        )}
      </section>

      {/* Features */}
      <section className={card}>
        <h2 className={heading}>Extra tools</h2>
        <p className={help}>Turn on only what you need. Turning one off hides it; nothing is deleted.</p>
        <ul className="mt-4 divide-y divide-brand-100">
          {FEATURES.map(f => (
            <li key={f.key} className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-bold text-gray-900">{f.title}</p>
                <p className="text-sm text-gray-500">{f.text}</p>
              </div>
              <Toggle label={f.title} on={s.features[f.key]} disabled={!canEdit} onChange={v => set('features', { ...s.features, [f.key]: v })} />
            </li>
          ))}
        </ul>
      </section>

      {canEdit && (
        <div className="sticky bottom-20 z-10 flex items-center justify-end gap-3 rounded-2xl border border-brand-200 bg-white/95 p-3 shadow-lg backdrop-blur lg:bottom-4">
          {dirty ? <span className="mr-auto text-sm text-gray-600">You have unsaved changes.</span> : <span className="mr-auto text-sm text-gray-500">All changes saved.</span>}
          <Button type="button" variant="ghost" disabled={!dirty || pending} onClick={() => setS(initial)}>Undo</Button>
          <Button type="button" onClick={save} loading={pending} disabled={!dirty || pending || problems.length > 0}>Save changes</Button>
        </div>
      )}
    </div>
  )
}
