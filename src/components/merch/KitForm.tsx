'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { useToast } from '@/components/ui/Toaster'
import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { saveMerchKit } from '@/actions/merch-kits'
import { ShowSelect, type ShowChoice } from './ShowSelect'
import { CrewPicker, type CrewPerson } from './CrewPicker'

export interface PackRow {
  variantId: string
  itemName: string
  label: string
  /** Usual price. */
  price: number
  /** Available to pack: at home, plus anything this kit already holds. */
  available: number
  /** Already sold from this kit (when editing): can't pack fewer than this. */
  sold: number
  taken: number
  showPrice: number | null
}

interface Props {
  kitId: string | null
  shows: ShowChoice[]
  members: CrewPerson[]
  rows: PackRow[]
  initial: { showId: string; leadId: string; helperIds: string[]; notes: string }
}

/** Packing a kit: which show, who runs the stall, and how many of each size go in the box. */
export function KitForm({ kitId, shows, members, rows, initial }: Props) {
  const { money, symbol } = useMoney()
  const router = useRouter()
  const toast = useToast()
  const [showId, setShowId] = useState(initial.showId)
  const [leadId, setLeadId] = useState(initial.leadId)
  const [helperIds, setHelperIds] = useState<string[]>(initial.helperIds)
  const [notes, setNotes] = useState(initial.notes)
  const [taken, setTaken] = useState<Record<string, string>>(Object.fromEntries(rows.filter(r => r.taken > 0).map(r => [r.variantId, String(r.taken)])))
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries(rows.filter(r => r.showPrice != null).map(r => [r.variantId, String(r.showPrice)])))
  const [busy, setBusy] = useState(false)

  const units = rows.reduce((n, r) => n + Math.max(0, Math.trunc(Number(taken[r.variantId] || 0))), 0)
  const over = rows.filter(r => Number(taken[r.variantId] || 0) > r.available)
  const items = [...new Set(rows.map(r => r.itemName))]

  const save = async () => {
    setBusy(true)
    const res = await saveMerchKit({
      id: kitId, showId, leadId: leadId || null, helperIds, notes,
      lines: rows.map(r => ({ variantId: r.variantId, taken: Number(taken[r.variantId] || 0), price: prices[r.variantId] ? Number(prices[r.variantId]) : null })),
    })
    setBusy(false)
    if (res.error) { toast(res.error, 'error'); return }
    toast(kitId ? 'Kit saved' : 'Kit packed', 'success')
    router.push(`/merch/kits/${res.id}`)
    router.refresh()
  }

  return (
    <div className="max-w-2xl pb-10">
      <Link href={kitId ? `/merch/kits/${kitId}` : '/merch'} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> {kitId ? 'Kit' : 'Merch'}
      </Link>
      <h1 className="mb-1 text-3xl font-bold text-gray-900">{kitId ? 'Edit kit' : 'Pack a kit'}</h1>
      <p className="mb-5 text-sm text-gray-500">What goes to the show. The crew on the kit see only this, sell from it, and close it at the end of the night.</p>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="kit-show">Show</Label>
          <ShowSelect id="kit-show" shows={shows} value={showId} onChange={setShowId} />
        </div>
        <div className="sm:col-span-2">
          <CrewPicker people={members} leadId={leadId} helperIds={helperIds} onChange={next => { setLeadId(next.leadId); setHelperIds(next.helperIds) }} />
          <p className="mt-1.5 text-xs text-gray-500">You can change the crew later from the kit, any time before it’s closed.</p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="kit-notes">Notes for the crew</Label>
          <Input id="kit-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000} placeholder="Where the box is, stall setup, anything they should know" />
        </div>
      </div>

      <SectionLabel className="mb-2">What’s going</SectionLabel>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing in stock to pack. Log a restock first.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-bold">Item</th>
                <th className="px-2 py-2 text-right font-bold">At home</th>
                <th className="px-2 py-2 text-right font-bold">Taking</th>
                <th className="px-4 py-2 text-right font-bold">Show price</th>
              </tr>
            </thead>
            <tbody>
              {items.map(name => rows.filter(r => r.itemName === name).map(r => {
                const n = Number(taken[r.variantId] || 0)
                return (
                  <tr key={r.variantId} className="border-t border-brand-100">
                    <td className="px-4 py-1.5 text-gray-900">{r.itemName} · {r.label}{r.sold > 0 && <span className="block text-[11px] text-gray-500">{r.sold} already sold</span>}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-600">{r.available}</td>
                    <td className="px-2 py-1.5 text-right">
                      <input aria-label={`${r.itemName} ${r.label} taking`} type="number" inputMode="numeric" min={r.sold} max={r.available} step={1} value={taken[r.variantId] ?? ''} placeholder="0"
                        onChange={e => setTaken(t => ({ ...t, [r.variantId]: e.target.value }))}
                        className={`w-16 rounded-md border bg-white px-1.5 py-1 text-right text-sm text-gray-900 focus:outline-none focus:ring-1 ${n > r.available ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:border-brand-400 focus:ring-brand-400'}`} />
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <input aria-label={`${r.itemName} ${r.label} show price`} type="number" inputMode="decimal" min={0} step="0.01" value={prices[r.variantId] ?? ''} placeholder={String(r.price)}
                        onChange={e => setPrices(p => ({ ...p, [r.variantId]: e.target.value }))}
                        className="w-20 rounded-md border border-gray-300 bg-white px-1.5 py-1 text-right text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400" />
                    </td>
                  </tr>
                )
              }))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-gray-500">Show price is optional ({symbol}); empty uses the usual price, e.g. {money(rows[0]?.price ?? 0)}.</p>
      {over.length > 0 && <p className="mt-2 text-sm text-red-700">Taking more than is at home on {over.length === 1 ? 'one item' : `${over.length} items`}.</p>}

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">{units} unit{units === 1 ? '' : 's'} going</p>
        <Button onClick={save} loading={busy} disabled={!showId || !leadId || units === 0 || over.length > 0}>{kitId ? 'Save kit' : 'Pack kit'}</Button>
      </div>
    </div>
  )
}
