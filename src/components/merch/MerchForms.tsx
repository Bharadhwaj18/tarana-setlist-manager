'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ReasonButton } from '@/components/ui/ReasonButton'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toaster'
import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { createMerchItem, updateMerchItem, addMerchVariant, updateMerchVariant, logMerchRestock, adjustMerchStock } from '@/actions/merch'
import { ADJUST_REASONS, REASON_LABELS, countFixFor, unitCostOf, type AdjustReason, type MerchItem, type MerchVariant } from '@/lib/merch'
import { todayISO } from '@/lib/shows'
import { ShowSelect } from './ShowSelect'

export interface ShowOption { id: string; title: string; show_date: string | null; venue?: string | null }

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

/** Runs a server action, shows its error or a success toast, refreshes the page and closes the form. */
function useSubmit(onDone: () => void) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = async (action: () => Promise<{ error?: string }>, success: string) => {
    setBusy(true)
    try {
      const res = await action()
      if (res.error) { toast(res.error, 'error'); return }
      toast(success, 'success')
      router.refresh()
      onDone()
    } catch {
      toast('Something went wrong. Try again.', 'error')
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}

// ---- Item ---------------------------------------------------------------------------------------------------------

export function ItemModal({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item?: MerchItem | null }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={item ? 'Edit item' : 'New merch item'} description={item ? undefined : 'A product line, like a logo tee or a sticker pack.'}>
      {open && <ItemForm item={item ?? null} onDone={() => onOpenChange(false)} />}
    </Modal>
  )
}

function ItemForm({ item, onDone }: { item: MerchItem | null; onDone: () => void }) {
  const { symbol } = useMoney()
  const { busy, run } = useSubmit(onDone)
  const [name, setName] = useState(item?.name ?? '')
  const [kind, setKind] = useState(item?.kind ?? '')
  const [price, setPrice] = useState(item ? String(item.price) : '')
  const [variants, setVariants] = useState('')
  const [description, setDescription] = useState(item?.description ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const input = { name, kind, description, price: Number(price || 0) }
    void run(() => (item ? updateMerchItem(item.id, input) : createMerchItem({ ...input, variants })), item ? 'Item saved' : 'Item added')
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name" htmlFor="merch-name">
        <Input id="merch-name" value={name} onChange={e => setName(e.target.value)} placeholder="Logo tee" maxLength={80} required autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" htmlFor="merch-kind">
          <Input id="merch-kind" value={kind} onChange={e => setKind(e.target.value)} placeholder="T-shirt" maxLength={40} />
        </Field>
        <Field label={`Price (${symbol})`} htmlFor="merch-price">
          <Input id="merch-price" type="number" inputMode="decimal" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" />
        </Field>
      </div>
      {!item && (
        <Field label="Sizes or versions" htmlFor="merch-variants" hint="Separate with commas. Leave empty for a single “One size”. You can add more later.">
          <Input id="merch-variants" value={variants} onChange={e => setVariants(e.target.value)} placeholder="S, M, L, XL" />
        </Field>
      )}
      <Field label="Notes" htmlFor="merch-desc">
        <Textarea id="merch-desc" value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={2000} placeholder="Fabric, print, supplier details…" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={busy}>{item ? 'Save' : 'Add item'}</Button>
      </div>
    </form>
  )
}

// ---- Variant ------------------------------------------------------------------------------------------------------

export function VariantModal({ open, onOpenChange, item, variant }: { open: boolean; onOpenChange: (o: boolean) => void; item: MerchItem | null; variant?: MerchVariant | null }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={variant ? `Edit ${variant.label}` : `Add a size or version${item ? ` to ${item.name}` : ''}`}>
      {open && item && <VariantForm item={item} variant={variant ?? null} onDone={() => onOpenChange(false)} />}
    </Modal>
  )
}

function VariantForm({ item, variant, onDone }: { item: MerchItem; variant: MerchVariant | null; onDone: () => void }) {
  const { symbol, money } = useMoney()
  const { busy, run } = useSubmit(onDone)
  const [label, setLabel] = useState(variant?.label ?? '')
  const [price, setPrice] = useState(variant?.price != null ? String(variant.price) : '')
  const [low, setLow] = useState(variant?.low_stock_at != null ? String(variant.low_stock_at) : '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const input = { label, price: price === '' ? null : Number(price), lowStockAt: low === '' ? null : Number(low) }
    void run(() => (variant ? updateMerchVariant(variant.id, input) : addMerchVariant(item.id, input)), variant ? 'Saved' : 'Added')
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name" htmlFor="variant-label">
        <Input id="variant-label" value={label} onChange={e => setLabel(e.target.value)} placeholder="XL or Black / M" maxLength={40} required autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Price (${symbol})`} htmlFor="variant-price" hint={`Empty uses the item price (${money(Number(item.price))}).`}>
          <Input id="variant-price" type="number" inputMode="decimal" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
        </Field>
        <Field label="Warn at" htmlFor="variant-low" hint="Flag as low when stock gets this low.">
          <Input id="variant-low" type="number" inputMode="numeric" min={0} step={1} value={low} onChange={e => setLow(e.target.value)} placeholder="e.g. 5" />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={busy}>{variant ? 'Save' : 'Add'}</Button>
      </div>
    </form>
  )
}

// ---- Restock ------------------------------------------------------------------------------------------------------

export function RestockModal({ open, onOpenChange, items, variants, focusItemId }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  items: MerchItem[]
  variants: MerchVariant[]
  focusItemId?: string | null
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Log a restock" description="New stock in from a print run or supplier. The total cost is spread evenly over every unit." className="max-w-xl">
      {open && <RestockForm items={items} variants={variants} focusItemId={focusItemId ?? null} onDone={() => onOpenChange(false)} />}
    </Modal>
  )
}

function RestockForm({ items, variants, focusItemId, onDone }: { items: MerchItem[]; variants: MerchVariant[]; focusItemId: string | null; onDone: () => void }) {
  const { symbol, money } = useMoney()
  const { busy, run } = useSubmit(onDone)
  const [date, setDate] = useState(todayISO())
  const [supplier, setSupplier] = useState('')
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')
  const [qty, setQty] = useState<Record<string, string>>({})

  const shown = focusItemId ? items.filter(i => i.id === focusItemId) : items
  const lines = Object.entries(qty).map(([variantId, q]) => ({ variantId, qty: Math.trunc(Number(q) || 0) })).filter(l => l.qty > 0)
  const units = lines.reduce((n, l) => n + l.qty, 0)
  const perUnit = unitCostOf(Number(cost || 0), lines)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run(() => logMerchRestock({ date, supplier, totalCost: Number(cost || 0), notes, lines }), `${units} unit${units === 1 ? '' : 's'} added to stock`)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="max-h-[40vh] space-y-3 overflow-y-auto rounded-xl border border-brand-100 p-3">
        {shown.map(item => {
          const vs = variants.filter(v => v.item_id === item.id && !v.archived_at)
          if (!vs.length) return null
          return (
            <div key={item.id}>
              <p className="mb-1.5 text-sm font-semibold text-gray-900">{item.name}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {vs.map(v => (
                  <label key={v.id} className="flex items-center gap-2 rounded-lg bg-brand-50 px-2 py-1.5 text-sm text-gray-700">
                    <span className="min-w-0 flex-1 truncate" title={v.label}>{v.label}</span>
                    <input
                      type="number" inputMode="numeric" min={0} step={1} aria-label={`${item.name} ${v.label} quantity`}
                      value={qty[v.id] ?? ''} onChange={e => setQty(q => ({ ...q, [v.id]: e.target.value }))}
                      className="w-14 rounded-md border border-gray-300 bg-white px-1.5 py-1 text-right text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                      placeholder="0"
                    />
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="restock-date">
          <Input id="restock-date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </Field>
        <Field label={`Total cost (${symbol})`} htmlFor="restock-cost" hint={perUnit != null ? `${money(perUnit)} per unit` : 'Optional, used for profit.'}>
          <Input id="restock-cost" type="number" inputMode="decimal" min={0} step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="0" />
        </Field>
      </div>
      <Field label="Supplier" htmlFor="restock-supplier">
        <Input id="restock-supplier" value={supplier} onChange={e => setSupplier(e.target.value)} maxLength={120} placeholder="Printer or shop" />
      </Field>
      <Field label="Notes" htmlFor="restock-notes">
        <Textarea id="restock-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={2000} />
      </Field>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-500">{units} unit{units === 1 ? '' : 's'}</p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
          <ReasonButton type="submit" loading={busy} blocked={units === 0 ? 'Enter how many came in for at least one size.' : null}>Add to stock</ReasonButton>
        </div>
      </div>
    </form>
  )
}

// ---- Adjust -------------------------------------------------------------------------------------------------------

export function AdjustModal({ open, onOpenChange, item, variant, stock, shows }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  item: MerchItem | null
  variant: MerchVariant | null
  stock: number
  shows: ShowOption[]
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={item && variant ? `${item.name} · ${variant.label}` : 'Adjust stock'} description={`${stock} in stock now.`}>
      {open && variant && <AdjustForm variant={variant} stock={stock} shows={shows} onDone={() => onOpenChange(false)} />}
    </Modal>
  )
}

const ADJUST_HINTS: Record<AdjustReason, string> = {
  giveaway: 'Given to a venue, press, a friend…',
  damaged: 'Misprinted, torn, lost or stolen.',
  return: 'Came back into stock, like an exchange.',
  count_fix: 'Enter what you actually counted; the difference is recorded.',
}

function AdjustForm({ variant, stock, shows, onDone }: { variant: MerchVariant; stock: number; shows: ShowOption[]; onDone: () => void }) {
  const { busy, run } = useSubmit(onDone)
  const [reason, setReason] = useState<AdjustReason>('giveaway')
  const [qty, setQty] = useState('')
  const [date, setDate] = useState(todayISO())
  const [showId, setShowId] = useState('')
  const [note, setNote] = useState('')

  const isCount = reason === 'count_fix'
  const n = Math.trunc(Number(qty))
  const change = qty === '' ? 0 : isCount ? countFixFor(stock, n) : reason === 'return' ? Math.abs(n) : -Math.abs(n)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run(() => adjustMerchStock({ variantId: variant.id, reason, qty: isCount ? change : Math.abs(n), date, showId: showId || null, note }), 'Stock updated')
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {ADJUST_REASONS.map(r => (
          <button
            key={r} type="button" onClick={() => { setReason(r); setQty('') }} aria-pressed={reason === r}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${reason === r ? 'bg-brand-400 text-white' : 'bg-brand-100 text-gray-700 hover:bg-brand-200'}`}
          >
            {REASON_LABELS[r]}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">{ADJUST_HINTS[reason]}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={isCount ? 'Counted' : 'How many'} htmlFor="adjust-qty" hint={qty === '' ? undefined : `${change > 0 ? '+' : ''}${change} → ${stock + change} in stock`}>
          <Input id="adjust-qty" type="number" inputMode="numeric" min={0} step={1} value={qty} onChange={e => setQty(e.target.value)} required autoFocus />
        </Field>
        <Field label="Date" htmlFor="adjust-date">
          <Input id="adjust-date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </Field>
      </div>
      {!isCount && shows.length > 0 && (
        <Field label="At a show" htmlFor="adjust-show">
          <ShowSelect id="adjust-show" shows={shows} value={showId} onChange={setShowId} noneLabel="Not at a show" />
        </Field>
      )}
      <Field label="Note" htmlFor="adjust-note">
        <Input id="adjust-note" value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="Optional" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        <ReasonButton type="submit" loading={busy} blocked={qty === '' ? (isCount ? 'Enter how many you counted.' : 'Enter how many.') : change === 0 ? (isCount ? 'That matches what’s in stock already, so there’s nothing to fix.' : 'Enter a number above 0.') : null}>Save</ReasonButton>
      </div>
    </form>
  )
}
