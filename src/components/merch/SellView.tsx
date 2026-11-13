'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ReasonButton } from '@/components/ui/ReasonButton'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { SegmentedTabs } from '@/components/ui/Chip'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { StatusPill } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/Toaster'
import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { cn } from '@/lib/utils'
import { formatDateDMY } from '@/lib/dates'
import { todayISO } from '@/lib/shows'
import { expectedTotal, saleTakings, soldFromCount, statsByVariant, statsFor, variantPrice, type MerchItem, type MerchMove, type MerchSale, type MerchVariant, type PaymentMethod } from '@/lib/merch'
import { deleteMerchSale, recordMerchSale } from '@/actions/merch'
import type { ShowOption } from './MerchForms'
import { ShowSelect } from './ShowSelect'

type SaleWithShow = MerchSale & { show: { id: string; title: string; show_date: string | null } | null }

interface Props {
  items: MerchItem[]
  variants: MerchVariant[]
  moves: MerchMove[]
  sales: SaleWithShow[]
  shows: ShowOption[]
  members: { id: string; name: string }[]
  userId: string
  initialShowId: string
  canEdit: boolean
}

type Mode = 'stall' | 'count'

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
]

export function SellView({ items, variants, moves, sales, shows, members, userId, initialShowId, canEdit }: Props) {
  const { money } = useMoney()
  const router = useRouter()
  const toast = useToast()
  const [showId, setShowId] = useState(initialShowId)
  const show = shows.find(s => s.id === showId) ?? null
  const [date, setDate] = useState(show?.show_date ?? todayISO())
  const [mode, setMode] = useState<Mode>('stall')
  const [heldBy, setHeldBy] = useState(userId)

  const stats = statsByVariant(moves)
  const priceOf = (v: MerchVariant) => variantPrice(items.find(i => i.id === v.item_id) ?? { price: 0 }, v)
  const showSales = sales.filter(s => (s.show_id ?? '') === showId && (showId || s.date === date))

  const pickShow = (id: string) => {
    setShowId(id)
    const s = shows.find(x => x.id === id)
    if (s?.show_date) setDate(s.show_date)
  }

  if (!canEdit) {
    return (
      <div className="max-w-2xl">
        <BackLink />
        <p className="text-sm text-gray-500">You can view merch but not record sales in this workspace.</p>
      </div>
    )
  }

  const sellable = items.filter(i => variants.some(v => v.item_id === i.id))

  return (
    <div className="max-w-2xl pb-10">
      <BackLink />
      <h1 className="mb-1 text-3xl font-bold text-gray-900">Sell merch</h1>
      <p className="mb-5 text-sm text-gray-500">Stock comes off straight away. The money waits for an approver before it goes into Finance.</p>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem_10rem]">
        <div className="space-y-1.5">
          <Label htmlFor="sell-show">Show</Label>
          <ShowSelect id="sell-show" shows={shows} value={showId} onChange={pickShow} noneLabel="Not at a show" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sell-date">Date</Label>
          <Input id="sell-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sell-held">Money with</Label>
          <Select id="sell-held" value={heldBy} onChange={e => setHeldBy(e.target.value)}>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </div>
      </div>

      {sellable.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-brand-200 px-6 py-10 text-center text-sm text-gray-500">
          Add merch items first, then come back to sell. <Link href="/merch" className="font-semibold text-brand-400 hover:underline">Go to Merch</Link>
        </p>
      ) : (
        <>
          <SegmentedTabs className="mb-4 [&>button]:leading-tight" value={mode} onChange={setMode} tabs={[{ value: 'stall', label: 'At the stall' }, { value: 'count', label: 'End-of-night count' }]} />
          {mode === 'stall'
            ? <StallMode key={`${showId}-${date}`} items={sellable} variants={variants} stockOf={id => statsFor(stats, id).stock} priceOf={priceOf}
                onSave={async (lines, method, amount) => {
                  const res = await recordMerchSale({ showId: showId || null, date, mode: 'stall', lines, heldBy, cash: method === 'cash' ? amount : 0, upi: method === 'upi' ? amount : 0, card: method === 'card' ? amount : 0 })
                  if (res.error) { toast(res.error, 'error'); return false }
                  toast(`Sale recorded: ${money(amount)}`, 'success')
                  router.refresh()
                  return true
                }} />
            : <CountMode key={`${showId}-${date}`} items={sellable} variants={variants} stockOf={id => statsFor(stats, id).stock} priceOf={priceOf}
                onSave={async (lines, paid, notes) => {
                  const res = await recordMerchSale({ showId: showId || null, date, mode: 'count', lines, heldBy, notes, ...paid })
                  if (res.error) { toast(res.error, 'error'); return false }
                  toast('Count saved. It’s waiting for approval.', 'success')
                  router.refresh()
                  return true
                }} />}
        </>
      )}

      <SalesSoFar sales={showSales} members={members} userId={userId} label={show ? `Recorded for ${show.title}` : `Recorded on ${formatDateDMY(date)} (no show)`} />
    </div>
  )
}

function BackLink() {
  return (
    <Link href="/merch" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700">
      <ChevronLeft className="h-4 w-4" /> Merch
    </Link>
  )
}

// ---- At the stall: tap to add, pick how they paid, record ----------------------------------------------------------

function StallMode({ items, variants, stockOf, priceOf, onSave }: {
  items: MerchItem[]
  variants: MerchVariant[]
  stockOf: (variantId: string) => number
  priceOf: (v: MerchVariant) => number
  onSave: (lines: { variantId: string; qty: number }[], method: PaymentMethod, amount: number) => Promise<boolean>
}) {
  const { money, symbol } = useMoney()
  const [cart, setCart] = useState<Record<string, number>>({})
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [amount, setAmount] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const lines = Object.entries(cart).filter(([, q]) => q > 0).map(([variantId, qty]) => ({ variantId, qty }))
  const total = expectedTotal(lines.map(l => ({ qty: l.qty, price: priceOf(variants.find(v => v.id === l.variantId)!) })))
  const paid = amount === null ? total : Number(amount || 0)
  const add = (id: string, d: number) => setCart(c => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }))

  const save = async () => {
    setBusy(true)
    const ok = await onSave(lines, method, paid)
    setBusy(false)
    if (ok) { setCart({}); setAmount(null) }
  }

  return (
    <div className="space-y-4">
      {items.map(item => (
        <div key={item.id}>
          <SectionLabel className="mb-1.5">{item.name}</SectionLabel>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {variants.filter(v => v.item_id === item.id).map(v => {
              const inCart = cart[v.id] ?? 0
              const left = stockOf(v.id) - inCart
              return (
                <button
                  key={v.id} type="button" onClick={() => add(v.id, 1)}
                  className={cn('relative rounded-xl border px-2 py-3 text-center transition-colors active:scale-[0.97]',
                    inCart ? 'border-brand-400 bg-brand-100' : 'border-brand-200 bg-white hover:bg-brand-50')}
                >
                  <span className="block truncate text-sm font-bold text-gray-900">{v.label}</span>
                  <span className="block truncate text-xs text-gray-500">{money(priceOf(v))}</span>
                  <span className={cn('block truncate text-[11px]', left <= 0 ? 'font-semibold text-red-700' : 'text-gray-500')}>{left} left</span>
                  {inCart > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-400 px-1.5 text-xs font-bold text-white">{inCart}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="sticky bottom-20 rounded-2xl border border-brand-200 bg-white p-4 shadow-lg lg:bottom-4">
        {lines.length === 0 ? (
          <p className="text-center text-sm text-gray-500">Tap what they’re buying.</p>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-1">
              {lines.map(l => {
                const v = variants.find(x => x.id === l.variantId)!
                const item = items.find(i => i.id === v.item_id)
                return (
                  <li key={l.variantId} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-gray-900">{item?.name} · {v.label}</span>
                    <button type="button" aria-label="One less" onClick={() => add(l.variantId, -1)} className="rounded-md p-1 text-gray-500 hover:bg-brand-100"><Minus className="h-4 w-4" /></button>
                    <span className="w-6 text-center font-semibold tabular-nums">{l.qty}</span>
                    <button type="button" aria-label="One more" onClick={() => add(l.variantId, 1)} className="rounded-md p-1 text-gray-500 hover:bg-brand-100"><Plus className="h-4 w-4" /></button>
                    <span className="w-20 text-right tabular-nums text-gray-600">{money(l.qty * priceOf(v))}</span>
                  </li>
                )
              })}
            </ul>
            <div className="flex flex-wrap items-end gap-3 border-t border-brand-100 pt-3">
              <div className="flex gap-1.5">
                {METHODS.map(m => (
                  <button key={m.value} type="button" aria-pressed={method === m.value} onClick={() => setMethod(m.value)}
                    className={cn('rounded-full px-3.5 py-1.5 text-xs font-bold', method === m.value ? 'bg-brand-400 text-white' : 'bg-brand-100 text-gray-700')}>
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="ml-auto w-32">
                <Label htmlFor="stall-amount" className="text-xs">Paid ({symbol})</Label>
                <Input id="stall-amount" type="number" inputMode="decimal" min={0} step="0.01" value={amount ?? String(total)} onChange={e => setAmount(e.target.value)} />
              </div>
              <Button onClick={save} loading={busy}>Record {money(paid)}</Button>
            </div>
            {paid !== total && <p className="text-xs text-amber-600">{paid < total ? `${money(total - paid)} discount` : `${money(paid - total)} over the list price`}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- End of night: what went out, what came back, what was taken ---------------------------------------------------

function CountMode({ items, variants, stockOf, priceOf, onSave }: {
  items: MerchItem[]
  variants: MerchVariant[]
  stockOf: (variantId: string) => number
  priceOf: (v: MerchVariant) => number
  onSave: (lines: { variantId: string; qty: number }[], paid: { cash: number; upi: number; card: number }, notes: string) => Promise<boolean>
}) {
  const { money, symbol } = useMoney()
  const [counts, setCounts] = useState<Record<string, { out: string; back: string }>>({})
  const [paid, setPaid] = useState({ cash: '', upi: '', card: '' })
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const rows = variants.map(v => {
    const c = counts[v.id] ?? { out: '', back: '' }
    const result = c.out === '' && c.back === '' ? { sold: 0 } : soldFromCount(Number(c.out || 0), Number(c.back || 0))
    return { v, c, result }
  })
  const problems = rows.filter(r => 'error' in r.result)
  const lines = rows.flatMap(r => ('sold' in r.result && r.result.sold > 0 ? [{ variantId: r.v.id, qty: r.result.sold }] : []))
  const expected = expectedTotal(lines.map(l => ({ qty: l.qty, price: priceOf(variants.find(v => v.id === l.variantId)!) })))
  const taken = saleTakings({ cash_amount: Number(paid.cash || 0), upi_amount: Number(paid.upi || 0), card_amount: Number(paid.card || 0) })
  const set = (id: string, key: 'out' | 'back', value: string) => setCounts(c => ({ ...c, [id]: { ...(c[id] ?? { out: '', back: '' }), [key]: value } }))

  const save = async () => {
    setBusy(true)
    const ok = await onSave(lines, { cash: Number(paid.cash || 0), upi: Number(paid.upi || 0), card: Number(paid.card || 0) }, notes)
    setBusy(false)
    if (ok) { setCounts({}); setPaid({ cash: '', upi: '', card: '' }); setNotes('') }
  }

  const cell = 'w-16 rounded-md border border-gray-300 bg-white px-1.5 py-1 text-right text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-2 font-bold">Item</th>
              <th className="px-2 py-2 text-right font-bold">Took</th>
              <th className="px-2 py-2 text-right font-bold">Back</th>
              <th className="px-4 py-2 text-right font-bold">Sold</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => variants.filter(v => v.item_id === item.id).map(v => {
              const r = rows.find(x => x.v.id === v.id)!
              return (
                <tr key={v.id} className="border-t border-brand-100">
                  <td className="px-4 py-1.5 text-gray-900">
                    {item.name} · {v.label}
                    <span className="block text-[11px] text-gray-500">{stockOf(v.id)} in stock · {money(priceOf(v))}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right"><input aria-label={`${item.name} ${v.label} took out`} type="number" inputMode="numeric" min={0} step={1} className={cell} value={r.c.out} onChange={e => set(v.id, 'out', e.target.value)} /></td>
                  <td className="px-2 py-1.5 text-right"><input aria-label={`${item.name} ${v.label} brought back`} type="number" inputMode="numeric" min={0} step={1} className={cell} value={r.c.back} onChange={e => set(v.id, 'back', e.target.value)} /></td>
                  <td className={cn('px-4 py-1.5 text-right font-semibold tabular-nums', 'error' in r.result ? 'text-red-700' : 'text-gray-900')}>
                    {'error' in r.result ? '!' : r.result.sold || ''}
                  </td>
                </tr>
              )
            }))}
          </tbody>
        </table>
      </div>
      {problems.length > 0 && <p className="text-sm text-red-700">{problems.length === 1 ? 'One row has' : `${problems.length} rows have`} more coming back than went out.</p>}

      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-3">
          {METHODS.map(m => (
            <div key={m.value} className="space-y-1.5">
              <Label htmlFor={`count-${m.value}`}>{m.label} ({symbol})</Label>
              <Input id={`count-${m.value}`} type="number" inputMode="decimal" min={0} step="0.01" value={paid[m.value]} onChange={e => setPaid(p => ({ ...p, [m.value]: e.target.value }))} placeholder="0" />
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="count-notes">Notes</Label>
          <Input id="count-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000} placeholder="Discounts, freebies, anything odd" />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 pt-3 text-sm">
          <div>
            <p className="text-gray-700">{lines.reduce((n, l) => n + l.qty, 0)} sold · should be <span className="font-semibold">{money(expected)}</span></p>
            <p className={cn('font-semibold', taken === expected ? 'text-gray-900' : 'text-amber-600')}>
              Taken {money(taken)}{taken !== expected && ` (${taken < expected ? 'short' : 'over'} by ${money(Math.abs(taken - expected))})`}
            </p>
          </div>
          <ReasonButton onClick={save} loading={busy}
            blocked={problems.length ? 'Some rows have more coming back than went out (marked !).' : lines.length === 0 && taken === 0 ? 'Enter what went out and came back, or the money taken.' : null}>
            Save count
          </ReasonButton>
        </div>
      </div>
    </div>
  )
}

// ---- What's been recorded so far for this show ----------------------------------------------------------------------

function SalesSoFar({ sales, members, userId, label }: { sales: SaleWithShow[]; members: { id: string; name: string }[]; userId: string; label: string }) {
  const { money } = useMoney()
  const router = useRouter()
  const toast = useToast()
  if (!sales.length) return null
  const total = sales.reduce((sum, s) => sum + saleTakings(s), 0)
  const nameOf = (id: string | null) => members.find(m => m.id === id)?.name ?? 'Someone'

  const remove = async (id: string) => {
    if (!confirm('Delete this sale? Its stock goes back.')) return
    const res = await deleteMerchSale(id)
    if (res.error) { toast(res.error, 'error'); return }
    toast('Sale deleted', 'success')
    router.refresh()
  }

  return (
    <div className="mt-8">
      <SectionLabel className="mb-2">{label} · {money(total)}</SectionLabel>
      <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-sm">
        {sales.map(s => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900">{money(saleTakings(s))} <span className="font-normal text-gray-500">· {s.mode === 'count' ? 'end-of-night count' : 'stall'} · with {nameOf(s.held_by)}</span></p>
              {s.notes && <p className="truncate text-xs text-gray-500">{s.notes}</p>}
            </div>
            <StatusPill tone={s.status === 'approved' ? 'green' : 'amber'}>{s.status === 'approved' ? 'In Finance' : 'Waiting'}</StatusPill>
            {s.status === 'pending' && (s.created_by === userId) && (
              <button type="button" aria-label="Delete sale" onClick={() => remove(s.id)} className="rounded-md p-1.5 text-gray-500 hover:bg-brand-100 hover:text-gray-900"><Trash2 className="h-4 w-4" /></button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
