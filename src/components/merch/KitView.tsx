'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, Minus, Pencil, Plus, RotateCcw, Trash2, Undo2, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { StatusPill } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/Toaster'
import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { cn } from '@/lib/utils'
import { formatDateDMY } from '@/lib/dates'
import { KIT_STATUS_LABELS, closeoutSold, expectedTotal, kitLeft, saleTakings, type KitStatus, type MerchKit, type MerchSale, type PaymentMethod } from '@/lib/merch'
import { approveMerchKit, closeMerchKit, deleteMerchKit, recordKitSale, reopenMerchKit, setMerchKitCrew, undoKitSale } from '@/actions/merch-kits'
import { CrewPicker, type CrewPerson } from './CrewPicker'

export interface KitLineView {
  variantId: string
  itemName: string
  label: string
  taken: number
  /** What one sells for at this show. */
  price: number
  returned: number | null
  given: number
  lost: number
  sold: number
}

interface Props {
  kit: MerchKit
  show: { id: string | null; title: string; show_date: string | null; venue: string | null } | null
  lines: KitLineView[]
  sales: MerchSale[]
  people: { lead: string | null; helpers: string[]; nameOf: Record<string, string> }
  userId: string
  can: { sell: boolean; pack: boolean; approve: boolean; fullView: boolean }
  members: { id: string; name: string }[]
  /** Everyone, for changing the crew (Merch crew first). Empty for people who can't change it. */
  crewPeople: CrewPerson[]
  accounts: { id: string; name: string }[]
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
]

/** Runs an action with a toast and a refresh. Returns whether it worked. */
function useRun() {
  const router = useRouter()
  const toast = useToast()
  return async (action: () => Promise<{ error?: string }>, success: string) => {
    const res = await action()
    if (res.error) { toast(res.error, 'error'); return false }
    toast(success, 'success')
    router.refresh()
    return true
  }
}

export function KitView({ kit, show, lines, sales, people, userId, can, members, crewPeople, accounts }: Props) {
  const { money } = useMoney()
  const router = useRouter()
  const run = useRun()
  const status = kit.status as KitStatus
  const [closing, setClosing] = useState(false)
  const [approving, setApproving] = useState(false)
  const [changingCrew, setChangingCrew] = useState(false)

  const went = lines.reduce((n, l) => n + l.taken, 0)
  const soldUnits = lines.reduce((n, l) => n + l.sold, 0)
  const tapped = sales.filter(s => s.mode === 'stall')
  const handedIn = Number(kit.cash_in ?? 0) + Number(kit.upi_in ?? 0) + Number(kit.card_in ?? 0)
  const shouldBe = expectedTotal(lines.map(l => ({ qty: l.sold, price: l.price })))

  return (
    <div className="max-w-2xl pb-10">
      <Link href="/merch" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Merch
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{show?.title ?? 'Deleted show'}</h1>
          <p className="mt-1 text-sm text-gray-500">{[show?.show_date && formatDateDMY(show.show_date), show?.venue].filter(Boolean).join(' · ')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusPill tone={status === 'approved' ? 'green' : status === 'closed' ? 'amber' : 'gray'}>{KIT_STATUS_LABELS[status]}</StatusPill>
            <span className="text-xs text-gray-500">{people.lead ? <>Run by {people.lead}{people.helpers.length ? `, with ${people.helpers.join(', ')}` : ''}</> : 'Nobody is running this kit'}</span>
            {can.pack && status === 'open' && (
              <button type="button" onClick={() => setChangingCrew(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 hover:underline">
                <Users className="h-3.5 w-3.5" />Change crew
              </button>
            )}
          </div>
        </div>
        {can.pack && status === 'open' && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" asChild><Link href={`/merch/kits/${kit.id}/edit`}><Pencil className="h-4 w-4" />Edit kit</Link></Button>
            {sales.length === 0 && (
              <Button variant="ghost" size="sm" aria-label="Delete kit" onClick={async () => {
                if (!confirm('Delete this kit? Nothing has been sold from it.')) return
                if (await run(() => deleteMerchKit(kit.id), 'Kit deleted')) router.push('/merch')
              }}><Trash2 className="h-4 w-4" /></Button>
            )}
          </div>
        )}
      </div>

      {kit.notes && <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-gray-700">{kit.notes}</p>}

      {/* What's in the box */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-2 font-bold">Item</th>
              <th className="px-2 py-2 text-right font-bold">Went</th>
              <th className="px-2 py-2 text-right font-bold">Sold</th>
              {status === 'open'
                ? <th className="px-4 py-2 text-right font-bold">Left</th>
                : <th className="px-4 py-2 text-right font-bold">Back</th>}
            </tr>
          </thead>
          <tbody>
            {lines.map(l => (
              <tr key={l.variantId} className="border-t border-brand-100">
                <td className="px-4 py-2 text-gray-900">
                  {l.itemName} · {l.label}
                  <span className="block text-[11px] text-gray-500">
                    {money(l.price)} each
                    {status !== 'open' && (l.given > 0 || l.lost > 0) && ` · ${[l.given && `${l.given} given away`, l.lost && `${l.lost} missing`].filter(Boolean).join(', ')}`}
                  </span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-gray-600">{l.taken}</td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums text-gray-900">{l.sold}</td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-600">{status === 'open' ? kitLeft(l.taken, l.sold) : l.returned ?? '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-brand-200 text-sm font-semibold text-gray-900">
              <td className="px-4 py-2">Total</td>
              <td className="px-2 py-2 text-right tabular-nums">{went}</td>
              <td className="px-2 py-2 text-right tabular-nums">{soldUnits}</td>
              <td className="px-4 py-2 text-right tabular-nums">{status === 'open' ? lines.reduce((n, l) => n + kitLeft(l.taken, l.sold), 0) : lines.reduce((n, l) => n + (l.returned ?? 0), 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {status === 'open' && can.sell && (
        <>
          <StallPanel kitId={kit.id} lines={lines} />
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => setClosing(true)}><Check className="h-4 w-4" />End of night: close the kit</Button>
          </div>
        </>
      )}

      {status !== 'open' && (
        <div className="mb-5 rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
          <SectionLabel className="mb-2">Money handed in</SectionLabel>
          <p className="text-2xl font-bold tabular-nums text-gray-900">{money(handedIn)}</p>
          <p className="text-xs text-gray-500">
            {[Number(kit.cash_in) && `${money(Number(kit.cash_in))} cash`, Number(kit.upi_in) && `${money(Number(kit.upi_in))} UPI`, Number(kit.card_in) && `${money(Number(kit.card_in))} card`].filter(Boolean).join(' · ') || 'Nothing taken'}
          </p>
          <p className={cn('mt-1 text-sm', handedIn === shouldBe ? 'text-gray-600' : 'font-semibold text-amber-600')}>
            {soldUnits} sold at show prices comes to {money(shouldBe)}
            {handedIn !== shouldBe && ` (${handedIn < shouldBe ? 'short' : 'over'} by ${money(Math.abs(shouldBe - handedIn))})`}
          </p>
          {kit.close_notes && <p className="mt-2 text-sm text-gray-600">“{kit.close_notes}”</p>}
          {kit.closed_by && <p className="mt-2 text-xs text-gray-500">Closed by {people.nameOf[kit.closed_by] ?? 'Member'}{kit.closed_at ? ` on ${formatDateDMY(kit.closed_at.slice(0, 10))}` : ''}</p>}

          {status === 'closed' && can.approve && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-brand-100 pt-3">
              <Button onClick={() => setApproving(true)}><Check className="h-4 w-4" />Approve into Finance</Button>
              <Button variant="secondary" onClick={() => { if (confirm('Reopen this kit? The counts and money are cleared so it can be closed again.')) void run(() => reopenMerchKit(kit.id), 'Kit reopened') }}>
                <RotateCcw className="h-4 w-4" />Reopen
              </Button>
            </div>
          )}
          {status === 'closed' && !can.approve && <p className="mt-3 text-xs text-gray-500">Waiting for an admin or someone with the Merch role to approve it.</p>}
        </div>
      )}

      {/* Sales tapped at the stall */}
      {tapped.length > 0 && (
        <div className="mt-6">
          <SectionLabel className="mb-2">Sales at the stall · {money(tapped.reduce((n, s) => n + saleTakings(s), 0))}</SectionLabel>
          <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-sm">
            {tapped.map(s => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 flex-1 text-gray-900">
                  {money(saleTakings(s))}
                  <span className="text-gray-500"> · {Number(s.cash_amount) ? 'cash' : Number(s.upi_amount) ? 'UPI' : Number(s.card_amount) ? 'card' : 'free'} · {new Date(s.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{can.fullView ? ` · ${people.nameOf[s.created_by] ?? 'Member'}` : ''}</span>
                </span>
                {status === 'open' && (s.created_by === userId || can.pack) && (
                  <button type="button" aria-label="Undo this sale" title="Undo" onClick={() => { if (confirm('Undo this sale? The items go back in the box.')) void run(() => undoKitSale(s.id, kit.id), 'Sale undone') }}
                    className="rounded-md p-1.5 text-gray-500 hover:bg-brand-100 hover:text-gray-900"><Undo2 className="h-4 w-4" /></button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={closing} onOpenChange={setClosing} title="Close the kit" description="Count what came back and the money you’re handing in." className="max-w-xl">
        {closing && <CloseForm kitId={kit.id} lines={lines} tappedMoney={tapped.reduce((n, s) => n + saleTakings(s), 0)} onDone={() => setClosing(false)} />}
      </Modal>
      <Modal open={changingCrew} onOpenChange={setChangingCrew} title="Change the crew" description="Whoever you take off loses access to this kit straight away. Anyone new is told.">
        {changingCrew && <CrewForm kit={kit} people={crewPeople} onDone={() => setChangingCrew(false)} />}
      </Modal>
      <Modal open={approving} onOpenChange={setApproving} title="Approve this kit" description="Adds one income entry to Finance, takes giveaways and missing items off stock, and locks the kit.">
        {approving && <ApproveForm kit={kit} total={handedIn} members={members} accounts={accounts} onDone={() => setApproving(false)} />}
      </Modal>
    </div>
  )
}

// ---- Selling from the kit ---------------------------------------------------------------------------------------------

function StallPanel({ kitId, lines }: { kitId: string; lines: KitLineView[] }) {
  const { money, symbol } = useMoney()
  const run = useRun()
  const [cart, setCart] = useState<Record<string, number>>({})
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [amount, setAmount] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const picked = lines.filter(l => (cart[l.variantId] ?? 0) > 0)
  const total = expectedTotal(picked.map(l => ({ qty: cart[l.variantId], price: l.price })))
  const paid = amount === null ? total : Number(amount || 0)
  const add = (l: KitLineView, d: number) => setCart(c => ({ ...c, [l.variantId]: Math.min(kitLeft(l.taken, l.sold), Math.max(0, (c[l.variantId] ?? 0) + d)) }))

  const save = async () => {
    setBusy(true)
    const ok = await run(() => recordKitSale(kitId, picked.map(l => ({ variantId: l.variantId, qty: cart[l.variantId] })), { [method]: paid }), `Sale recorded: ${money(paid)}`)
    setBusy(false)
    if (ok) { setCart({}); setAmount(null) }
  }

  const byItem = [...new Set(lines.map(l => l.itemName))]

  return (
    <div className="space-y-4">
      <SectionLabel>Sell</SectionLabel>
      {byItem.map(name => (
        <div key={name}>
          <p className="mb-1.5 text-sm font-semibold text-gray-900">{name}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {lines.filter(l => l.itemName === name).map(l => {
              const inCart = cart[l.variantId] ?? 0
              const left = kitLeft(l.taken, l.sold) - inCart
              return (
                <button key={l.variantId} type="button" disabled={left <= 0} onClick={() => add(l, 1)}
                  className={cn('relative rounded-xl border px-2 py-3 text-center transition-colors enabled:active:scale-[0.97] disabled:opacity-50',
                    inCart ? 'border-brand-400 bg-brand-100' : 'border-brand-200 bg-white enabled:hover:bg-brand-50')}>
                  <span className="block truncate text-sm font-bold text-gray-900">{l.label}</span>
                  <span className="block truncate text-xs text-gray-500">{money(l.price)}</span>
                  <span className={cn('block truncate text-[11px]', left <= 0 ? 'font-semibold text-red-700' : 'text-gray-500')}>{left} left</span>
                  {inCart > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-400 px-1.5 text-xs font-bold text-white">{inCart}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="sticky bottom-20 rounded-2xl border border-brand-200 bg-white p-4 shadow-lg lg:bottom-4">
        {picked.length === 0 ? (
          <p className="text-center text-sm text-gray-500">Tap what they’re buying.</p>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-1">
              {picked.map(l => (
                <li key={l.variantId} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-gray-900">{l.itemName} · {l.label}</span>
                  <button type="button" aria-label="One less" onClick={() => add(l, -1)} className="rounded-md p-1 text-gray-500 hover:bg-brand-100"><Minus className="h-4 w-4" /></button>
                  <span className="w-6 text-center font-semibold tabular-nums">{cart[l.variantId]}</span>
                  <button type="button" aria-label="One more" onClick={() => add(l, 1)} className="rounded-md p-1 text-gray-500 hover:bg-brand-100"><Plus className="h-4 w-4" /></button>
                  <span className="w-20 text-right tabular-nums text-gray-600">{money(cart[l.variantId] * l.price)}</span>
                </li>
              ))}
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
                <Label htmlFor="kit-amount" className="text-xs">Paid ({symbol})</Label>
                <Input id="kit-amount" type="number" inputMode="decimal" min={0} step="0.01" value={amount ?? String(total)} onChange={e => setAmount(e.target.value)} />
              </div>
              <Button onClick={save} loading={busy}>Record {money(paid)}</Button>
            </div>
            {paid !== total && <p className="text-xs text-amber-600">{paid < total ? `${money(total - paid)} discount` : `${money(paid - total)} over the show price`}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Closing the kit ----------------------------------------------------------------------------------------------------

function CloseForm({ kitId, lines, tappedMoney, onDone }: { kitId: string; lines: KitLineView[]; tappedMoney: number; onDone: () => void }) {
  const { money, symbol } = useMoney()
  const run = useRun()
  const [counts, setCounts] = useState<Record<string, { returned: string; given: string; lost: string }>>({})
  const [paid, setPaid] = useState({ cash: '', upi: '', card: '' })
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const rows = lines.map(l => {
    const c = counts[l.variantId] ?? { returned: '', given: '', lost: '' }
    const n = (s: string) => Math.max(0, Math.trunc(Number(s || 0)))
    const extra = closeoutSold(l.taken, l.sold, n(c.returned), n(c.given), n(c.lost))
    return { l, c, extra, filled: c.returned !== '' }
  })
  const problems = rows.filter(r => r.extra < 0)
  const missing = rows.filter(r => !r.filled)
  const totalSold = rows.reduce((n, r) => n + r.l.sold + Math.max(0, r.extra), 0)
  const shouldBe = expectedTotal(rows.map(r => ({ qty: r.l.sold + Math.max(0, r.extra), price: r.l.price })))
  const handed = Number(paid.cash || 0) + Number(paid.upi || 0) + Number(paid.card || 0)
  const set = (id: string, key: 'returned' | 'given' | 'lost', value: string) =>
    setCounts(c => ({ ...c, [id]: { ...(c[id] ?? { returned: '', given: '', lost: '' }), [key]: value } }))
  const cell = 'w-14 rounded-md border border-gray-300 bg-white px-1.5 py-1 text-right text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

  const save = async () => {
    setBusy(true)
    const ok = await run(() => closeMerchKit(kitId, rows.map(r => ({ variantId: r.l.variantId, returned: Number(r.c.returned || 0), given: Number(r.c.given || 0), lost: Number(r.c.lost || 0) })),
      { cash: Number(paid.cash || 0), upi: Number(paid.upi || 0), card: Number(paid.card || 0) }, notes), 'Kit closed. It’s waiting for approval.')
    setBusy(false)
    if (ok) onDone()
  }

  return (
    <div className="space-y-4">
      <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-brand-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2 font-bold">Item</th>
              <th className="px-1 py-2 text-right font-bold">Back</th>
              <th className="px-1 py-2 text-right font-bold">Given</th>
              <th className="px-1 py-2 text-right font-bold">Lost</th>
              <th className="px-3 py-2 text-right font-bold">Sold</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.l.variantId} className="border-t border-brand-100">
                <td className="px-3 py-1.5 text-gray-900">
                  {r.l.itemName} · {r.l.label}
                  <span className="block text-[11px] text-gray-500">{r.l.taken} went · {r.l.sold} tapped</span>
                </td>
                <td className="px-1 py-1.5 text-right"><input aria-label={`${r.l.itemName} ${r.l.label} came back`} type="number" inputMode="numeric" min={0} className={cell} value={r.c.returned} onChange={e => set(r.l.variantId, 'returned', e.target.value)} /></td>
                <td className="px-1 py-1.5 text-right"><input aria-label={`${r.l.itemName} ${r.l.label} given away`} type="number" inputMode="numeric" min={0} className={cell} value={r.c.given} placeholder="0" onChange={e => set(r.l.variantId, 'given', e.target.value)} /></td>
                <td className="px-1 py-1.5 text-right"><input aria-label={`${r.l.itemName} ${r.l.label} lost`} type="number" inputMode="numeric" min={0} className={cell} value={r.c.lost} placeholder="0" onChange={e => set(r.l.variantId, 'lost', e.target.value)} /></td>
                <td className={cn('px-3 py-1.5 text-right font-semibold tabular-nums', r.extra < 0 ? 'text-red-700' : 'text-gray-900')}>
                  {r.extra < 0 ? '!' : r.l.sold + r.extra}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">Anything that went out, wasn’t tapped, and didn’t come back, get given away or go missing counts as sold.</p>
      {problems.length > 0 && <p className="text-sm text-red-700">More is counted than went out on {problems.length === 1 ? 'one item' : `${problems.length} items`}.</p>}

      <div>
        <SectionLabel className="mb-2">Money handed in (everything, including stall sales)</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          {METHODS.map(m => (
            <div key={m.value} className="space-y-1.5">
              <Label htmlFor={`close-${m.value}`}>{m.label} ({symbol})</Label>
              <Input id={`close-${m.value}`} type="number" inputMode="decimal" min={0} step="0.01" value={paid[m.value]} placeholder="0" onChange={e => setPaid(p => ({ ...p, [m.value]: e.target.value }))} />
            </div>
          ))}
        </div>
        {tappedMoney > 0 && <p className="mt-1 text-xs text-gray-500">{money(tappedMoney)} was recorded at the stall.</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="close-notes">Notes</Label>
        <Input id="close-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000} placeholder="Discounts, freebies, anything odd" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 pt-3 text-sm">
        <div>
          <p className="text-gray-700">{totalSold} sold · should be <span className="font-semibold">{money(shouldBe)}</span></p>
          <p className={cn('font-semibold', handed === shouldBe ? 'text-gray-900' : 'text-amber-600')}>
            Handing in {money(handed)}{handed !== shouldBe && ` (${handed < shouldBe ? 'short' : 'over'} by ${money(Math.abs(handed - shouldBe))})`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onDone}>Cancel</Button>
          <Button onClick={save} loading={busy} disabled={problems.length > 0 || missing.length > 0} title={missing.length ? 'Count what came back for every item' : undefined}>Close kit</Button>
        </div>
      </div>
    </div>
  )
}

// ---- Approving ---------------------------------------------------------------------------------------------------------

function ApproveForm({ kit, total, members, accounts, onDone }: { kit: MerchKit; total: number; members: { id: string; name: string }[]; accounts: { id: string; name: string }[]; onDone: () => void }) {
  const { money } = useMoney()
  const run = useRun()
  const start = kit.lead_id && members.some(m => m.id === kit.lead_id) ? `m:${kit.lead_id}` : members[0] ? `m:${members[0].id}` : ''
  const [to, setTo] = useState(start)
  const [busy, setBusy] = useState(false)

  const approve = async () => {
    setBusy(true)
    const ok = await run(() => approveMerchKit(kit.id, to.startsWith('a:') ? { accountId: to.slice(2) } : { memberId: to.slice(2) }), total > 0 ? `${money(total)} added to Finance` : 'Kit approved')
    setBusy(false)
    if (ok) onDone()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-brand-50 px-4 py-3">
        <p className="text-sm text-gray-600">Money handed in</p>
        <p className="text-2xl font-bold tabular-nums text-gray-900">{money(total)}</p>
      </div>
      {total > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="kit-approve-to">Who has the money</Label>
          <Select id="kit-approve-to" value={to} onChange={e => setTo(e.target.value)}>
            {members.map(m => <option key={m.id} value={`m:${m.id}`}>{m.name}</option>)}
            {accounts.map(a => <option key={a.id} value={`a:${a.id}`}>{a.name} (account)</option>)}
          </Select>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button onClick={approve} loading={busy}>Approve</Button>
      </div>
    </div>
  )
}

// ---- Changing the crew -------------------------------------------------------------------------------------------------

function CrewForm({ kit, people, onDone }: { kit: MerchKit; people: CrewPerson[]; onDone: () => void }) {
  const run = useRun()
  const [crew, setCrew] = useState({ leadId: kit.lead_id ?? '', helperIds: kit.helper_ids })
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    const ok = await run(() => setMerchKitCrew(kit.id, crew.leadId || null, crew.helperIds), 'Crew updated')
    setBusy(false)
    if (ok) onDone()
  }
  return (
    <div className="space-y-4">
      <CrewPicker people={people} leadId={crew.leadId} helperIds={crew.helperIds} onChange={setCrew} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button onClick={save} loading={busy} disabled={!crew.leadId}>Save crew</Button>
      </div>
    </div>
  )
}
