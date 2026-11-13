'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Archive, ArchiveRestore, PackagePlus, Pencil, Plus, ShoppingBag, Shirt, SlidersHorizontal, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SegmentedTabs, Chip } from '@/components/ui/Chip'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { useToast } from '@/components/ui/Toaster'
import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { cn } from '@/lib/utils'
import { formatDateDMY } from '@/lib/dates'
import { REASON_LABELS, isLowStock, isMoveReason, statsByVariant, statsFor, sumStats, variantPrice, type MerchBatch, type MerchItem, type MerchMove, type MerchVariant } from '@/lib/merch'
import { deleteMerchBatch, deleteMerchItem, deleteMerchMove, setMerchItemArchived, setMerchVariantArchived } from '@/actions/merch'
import { AdjustModal, ItemModal, RestockModal, VariantModal, type ShowOption } from './MerchForms'
import { PendingApprovals, SalesByShow, type AccountOption, type Person, type SaleWithShow } from './MerchSales'

type MoveWithShow = MerchMove & { show: { id: string; title: string; show_date: string | null } | null }

interface Props {
  items: MerchItem[]
  variants: MerchVariant[]
  moves: MoveWithShow[]
  batches: MerchBatch[]
  shows: ShowOption[]
  sales: SaleWithShow[]
  members: Person[]
  accounts: AccountOption[]
  canEdit: boolean
  canApprove: boolean
  userId: string
}

type Tab = 'stock' | 'sales' | 'history'

export function MerchView({ items, variants, moves, batches, shows, sales, members, accounts, canEdit, canApprove, userId }: Props) {
  const { money } = useMoney()
  const [tab, setTab] = useState<Tab>('stock')
  const [showArchived, setShowArchived] = useState(false)

  const [itemModal, setItemModal] = useState<{ open: boolean; item: MerchItem | null }>({ open: false, item: null })
  const [variantModal, setVariantModal] = useState<{ open: boolean; item: MerchItem | null; variant: MerchVariant | null }>({ open: false, item: null, variant: null })
  const [restock, setRestock] = useState<{ open: boolean; itemId: string | null }>({ open: false, itemId: null })
  const [adjust, setAdjust] = useState<{ open: boolean; item: MerchItem | null; variant: MerchVariant | null }>({ open: false, item: null, variant: null })

  const stats = useMemo(() => statsByVariant(moves), [moves])
  const activeItems = items.filter(i => !i.archived_at)
  const archivedItems = items.filter(i => i.archived_at)
  const liveVariants = variants.filter(v => !v.archived_at && activeItems.some(i => i.id === v.item_id))

  const totals = {
    ...sumStats(liveVariants.map(v => statsFor(stats, v.id))),
    stockValue: liveVariants.reduce((sum, v) => { const s = statsFor(stats, v.id); return sum + (s.avgCost != null ? Math.max(0, s.stock) * s.avgCost : 0) }, 0),
    low: liveVariants.filter(v => isLowStock(v, statsFor(stats, v.id).stock)).length,
  }

  const shownItems = showArchived ? archivedItems : activeItems

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Merch"
        subtitle="What’s in the box, what it cost, and what went out."
        action={canEdit && items.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" asChild><Link href="/merch/sell"><ShoppingBag className="h-4 w-4" />Sell</Link></Button>
            <Button variant="secondary" size="sm" onClick={() => setRestock({ open: true, itemId: null })}><PackagePlus className="h-4 w-4" />Restock</Button>
            <Button variant="secondary" size="sm" onClick={() => setItemModal({ open: true, item: null })}><Plus className="h-4 w-4" />New item</Button>
          </div>
        ) : undefined}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Shirt className="h-10 w-10" />}
          title="No merch yet"
          description="Add your first item, like a tee with its sizes, then log the stock you have."
          action={canEdit ? <Button onClick={() => setItemModal({ open: true, item: null })}><Plus className="h-4 w-4" />Add an item</Button> : undefined}
        />
      ) : (
        <>
          <PendingApprovals sales={sales} moves={moves} members={members} accounts={accounts} canApprove={canApprove} userId={userId} />
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="In stock" value={`${totals.stock}`} sub={totals.low > 0 ? `${totals.low} running low` : 'units'} warn={totals.low > 0} />
            <Tile label="Stock value" value={money(totals.stockValue)} sub="at cost" />
            <Tile label="Sold" value={`${totals.sold}`} sub="units, all time" />
            <Tile label="Takings" value={money(totals.revenue)} sub="all time" />
          </div>

          <SegmentedTabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'stock', label: 'Stock' }, { value: 'sales', label: 'Sales' }, { value: 'history', label: 'History' }]} />

          {tab === 'stock' ? (
            <div className="space-y-4">
              {archivedItems.length > 0 && (
                <div className="flex gap-2">
                  <Chip active={!showArchived} onClick={() => setShowArchived(false)}>Current</Chip>
                  <Chip active={showArchived} onClick={() => setShowArchived(true)}>Archived ({archivedItems.length})</Chip>
                </div>
              )}
              {shownItems.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  variants={variants.filter(v => v.item_id === item.id)}
                  stats={stats}
                  canEdit={canEdit}
                  onEdit={() => setItemModal({ open: true, item })}
                  onAddVariant={() => setVariantModal({ open: true, item, variant: null })}
                  onEditVariant={variant => setVariantModal({ open: true, item, variant })}
                  onRestock={() => setRestock({ open: true, itemId: item.id })}
                  onAdjust={variant => setAdjust({ open: true, item, variant })}
                />
              ))}
              {shownItems.length === 0 && <p className="py-6 text-center text-sm text-gray-500">Nothing here.</p>}
            </div>
          ) : tab === 'sales' ? (
            <SalesByShow sales={sales} moves={moves} />
          ) : (
            <History moves={moves} items={items} variants={variants} batches={batches} canEdit={canEdit} />
          )}
        </>
      )}

      <ItemModal open={itemModal.open} onOpenChange={open => setItemModal(m => ({ ...m, open }))} item={itemModal.item} />
      <VariantModal open={variantModal.open} onOpenChange={open => setVariantModal(m => ({ ...m, open }))} item={variantModal.item} variant={variantModal.variant} />
      <RestockModal open={restock.open} onOpenChange={open => setRestock(m => ({ ...m, open }))} items={activeItems} variants={variants} focusItemId={restock.itemId} />
      <AdjustModal
        open={adjust.open} onOpenChange={open => setAdjust(m => ({ ...m, open }))}
        item={adjust.item} variant={adjust.variant} shows={shows}
        stock={adjust.variant ? statsFor(stats, adjust.variant.id).stock : 0}
      />
    </div>
  )
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-gray-900">{value}</p>
      <p className={cn('text-xs', warn ? 'font-semibold text-amber-600' : 'text-gray-500')}>{sub}</p>
    </div>
  )
}

/** Runs a small action (archive, delete) with a toast and a refresh. */
function useQuickAction() {
  const router = useRouter()
  const toast = useToast()
  return async (action: () => Promise<{ error?: string }>, success: string) => {
    const res = await action()
    if (res.error) { toast(res.error, 'error'); return }
    toast(success, 'success')
    router.refresh()
  }
}

function ItemCard({ item, variants, stats, canEdit, onEdit, onAddVariant, onEditVariant, onRestock, onAdjust }: {
  item: MerchItem
  variants: MerchVariant[]
  stats: ReturnType<typeof statsByVariant>
  canEdit: boolean
  onEdit: () => void
  onAddVariant: () => void
  onEditVariant: (v: MerchVariant) => void
  onRestock: () => void
  onAdjust: (v: MerchVariant) => void
}) {
  const { money } = useMoney()
  const quick = useQuickAction()
  const [showArchivedVariants, setShowArchivedVariants] = useState(false)
  const live = variants.filter(v => !v.archived_at)
  const archived = variants.filter(v => v.archived_at)
  const total = sumStats(live.map(v => statsFor(stats, v.id)))
  const isArchived = !!item.archived_at
  const rows = showArchivedVariants ? variants : live

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{item.name}</p>
          <p className="text-xs text-gray-500">
            {[item.kind, money(Number(item.price)), total.avgCost != null ? `costs ${money(total.avgCost)}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1 text-right">
            <span className="block text-lg font-bold tabular-nums text-gray-900">{total.stock}</span>
            <span className="block text-[11px] text-gray-500">in stock</span>
          </span>
          {canEdit && !isArchived && (
            <>
              <IconButton label="Restock" onClick={onRestock}><PackagePlus className="h-4 w-4" /></IconButton>
              <IconButton label="Edit item" onClick={onEdit}><Pencil className="h-4 w-4" /></IconButton>
              <IconButton label="Archive item" onClick={() => quick(() => setMerchItemArchived(item.id, true), `${item.name} archived`)}><Archive className="h-4 w-4" /></IconButton>
            </>
          )}
          {canEdit && isArchived && (
            <>
              <IconButton label="Restore item" onClick={() => quick(() => setMerchItemArchived(item.id, false), `${item.name} restored`)}><ArchiveRestore className="h-4 w-4" /></IconButton>
              <IconButton label="Delete item" onClick={() => { if (confirm(`Delete ${item.name}? This can’t be undone.`)) void quick(() => deleteMerchItem(item.id), `${item.name} deleted`) }}><Trash2 className="h-4 w-4" /></IconButton>
            </>
          )}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-t border-brand-100 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
            <th className="px-4 py-1.5 font-bold">Variant</th>
            <th className="px-2 py-1.5 text-right font-bold">Stock</th>
            <th className="hidden px-2 py-1.5 text-right font-bold sm:table-cell">Sold</th>
            <th className="hidden px-2 py-1.5 text-right font-bold sm:table-cell">Price</th>
            <th className="w-px px-4 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map(v => {
            const s = statsFor(stats, v.id)
            const low = !v.archived_at && isLowStock(v, s.stock)
            return (
              <tr key={v.id} className={cn('border-t border-brand-100', v.archived_at && 'opacity-60')}>
                <td className="px-4 py-2 text-gray-900">
                  {v.label}
                  {v.archived_at && <span className="ml-1.5 text-xs text-gray-500">archived</span>}
                </td>
                <td className={cn('px-2 py-2 text-right font-semibold tabular-nums', s.stock < 0 ? 'text-red-700' : low ? 'text-amber-600' : 'text-gray-900')} title={low ? `Low: warns at ${v.low_stock_at}` : undefined}>
                  {s.stock}{low && ' ⚠'}
                </td>
                <td className="hidden px-2 py-2 text-right tabular-nums text-gray-600 sm:table-cell">{s.sold}</td>
                <td className="hidden px-2 py-2 text-right tabular-nums text-gray-600 sm:table-cell">{money(variantPrice(item, v))}</td>
                <td className="px-4 py-2">
                  {canEdit && !isArchived && (
                    <div className="flex justify-end gap-1">
                      {!v.archived_at && <IconButton label={`Adjust ${v.label}`} onClick={() => onAdjust(v)}><SlidersHorizontal className="h-4 w-4" /></IconButton>}
                      <IconButton label={`Edit ${v.label}`} onClick={() => onEditVariant(v)}><Pencil className="h-4 w-4" /></IconButton>
                      {v.archived_at
                        ? <IconButton label={`Restore ${v.label}`} onClick={() => quick(() => setMerchVariantArchived(v.id, false), `${v.label} restored`)}><ArchiveRestore className="h-4 w-4" /></IconButton>
                        : <IconButton label={`Archive ${v.label}`} onClick={() => quick(() => setMerchVariantArchived(v.id, true), `${v.label} archived`)}><Archive className="h-4 w-4" /></IconButton>}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {(canEdit && !isArchived) || archived.length > 0 ? (
        <div className="flex items-center justify-between border-t border-brand-100 px-4 py-2">
          {canEdit && !isArchived ? (
            <button type="button" onClick={onAddVariant} className="text-sm font-semibold text-brand-400 hover:underline">+ Add size or version</button>
          ) : <span />}
          {archived.length > 0 && (
            <button type="button" onClick={() => setShowArchivedVariants(s => !s)} className="text-xs text-gray-500 hover:underline">
              {showArchivedVariants ? 'Hide archived' : `Show ${archived.length} archived`}
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-brand-100 hover:text-gray-900">
      {children}
    </button>
  )
}

// ---- History ------------------------------------------------------------------------------------------------------

type HistoryRow =
  | { kind: 'batch'; key: string; date: string; created: string; batch: MerchBatch; moves: MoveWithShow[] }
  | { kind: 'move'; key: string; date: string; created: string; move: MoveWithShow }

function History({ moves, items, variants, batches, canEdit }: { moves: MoveWithShow[]; items: MerchItem[]; variants: MerchVariant[]; batches: MerchBatch[]; canEdit: boolean }) {
  const { money } = useMoney()
  const quick = useQuickAction()

  const nameOf = useMemo(() => {
    const itemById = new Map(items.map(i => [i.id, i]))
    const map = new Map(variants.map(v => [v.id, { item: itemById.get(v.item_id)?.name ?? 'Item', variant: v.label }]))
    return (variantId: string) => map.get(variantId) ?? { item: 'Removed item', variant: '' }
  }, [items, variants])

  // A restock shows as one row with its lines; everything else is one row per move.
  const rows = useMemo<HistoryRow[]>(() => {
    const byBatch = new Map<string, MoveWithShow[]>()
    const out: HistoryRow[] = []
    for (const m of moves) {
      if (m.batch_id) byBatch.set(m.batch_id, [...(byBatch.get(m.batch_id) ?? []), m])
      else out.push({ kind: 'move', key: m.id, date: m.date, created: m.created_at, move: m })
    }
    for (const b of batches) out.push({ kind: 'batch', key: b.id, date: b.date, created: b.created_at, batch: b, moves: byBatch.get(b.id) ?? [] })
    return out.sort((a, b) => (a.date === b.date ? b.created.localeCompare(a.created) : b.date.localeCompare(a.date)))
  }, [moves, batches])

  if (!rows.length) return <p className="py-6 text-center text-sm text-gray-500">Nothing logged yet. Restocks, sales and adjustments show up here.</p>

  return (
    <div className="space-y-1">
      {rows.map((row, i) => {
        const header = row.date !== rows[i - 1]?.date ? <SectionLabel className="pb-1 pt-3">{formatDateDMY(row.date)}</SectionLabel> : null
        if (row.kind === 'batch') {
          const units = row.moves.reduce((n, m) => n + m.qty, 0)
          return (
            <div key={row.key}>
              {header}
              <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-white px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">Restock{row.batch.supplier ? ` from ${row.batch.supplier}` : ''}</p>
                  <p className="text-xs text-gray-500">
                    {row.moves.map(m => { const n = nameOf(m.variant_id); return `${n.item} ${n.variant} ×${m.qty}` }).join(', ')}
                  </p>
                  {row.batch.notes && <p className="mt-0.5 text-xs text-gray-500">{row.batch.notes}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-brand-400 dark:text-emerald-400">+{units}</p>
                  {Number(row.batch.total_cost) > 0 && <p className="text-xs tabular-nums text-gray-500">{money(Number(row.batch.total_cost))}</p>}
                </div>
                {canEdit && (
                  <IconButton label="Delete restock" onClick={() => { if (confirm('Delete this restock and the stock it added?')) void quick(() => deleteMerchBatch(row.batch.id), 'Restock deleted') }}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                )}
              </div>
            </div>
          )
        }
        const m = row.move
        const n = nameOf(m.variant_id)
        const reason = isMoveReason(m.reason) ? REASON_LABELS[m.reason] : m.reason
        return (
          <div key={row.key}>
            {header}
            <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-white px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{reason} · {n.item} {n.variant}</p>
                <p className="text-xs text-gray-500">
                  {[m.show ? `at ${m.show.title}` : null, m.unit_price != null ? `${money(Number(m.unit_price))} each` : null, m.note].filter(Boolean).join(' · ') || ' '}
                </p>
              </div>
              <p className={cn('shrink-0 text-sm font-semibold tabular-nums', m.qty > 0 ? 'text-brand-400 dark:text-emerald-400' : 'text-red-700')}>
                {m.qty > 0 ? `+${m.qty}` : `−${Math.abs(m.qty)}`}
              </p>
              {canEdit && !m.sale_id && (
                <IconButton label="Undo this entry" onClick={() => { if (confirm('Undo this stock entry?')) void quick(() => deleteMerchMove(m.id), 'Entry removed') }}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
