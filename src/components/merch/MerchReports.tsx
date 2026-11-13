'use client'

import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { ReasonButton } from '@/components/ui/ReasonButton'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toaster'
import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { cn } from '@/lib/utils'
import { addDaysISO, formatDateDMY } from '@/lib/dates'
import { todayISO } from '@/lib/shows'
import { APP_SLUG } from '@/lib/brand'
import { buildMerchReport, reportCsv, type Period, type ReportRow } from '@/lib/merch-report'
import { buildMerchReportPdf } from '@/lib/pdf/merchReports'
import type { MerchItem, MerchKit, MerchMove, MerchSale, MerchVariant } from '@/lib/merch'

type ShowRef = { id: string; title: string; show_date: string | null } | null

const PRESETS = ['Last 30 days', 'Last 90 days', 'This year', 'All time', 'Custom'] as const
type Preset = (typeof PRESETS)[number]

function periodFor(preset: Preset, from: string, to: string): Period {
  const today = todayISO()
  if (preset === 'Last 30 days') return { from: addDaysISO(today, -30), to: today }
  if (preset === 'Last 90 days') return { from: addDaysISO(today, -90), to: today }
  if (preset === 'This year') return { from: `${today.slice(0, 4)}-01-01`, to: today }
  if (preset === 'Custom') return { from: from || null, to: to || null }
  return {}
}

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** The Reports tab: per show and per item, for a period, with CSV and PDF exports. */
export function MerchReports({ items, variants, moves, sales, kits }: {
  items: MerchItem[]
  variants: MerchVariant[]
  moves: (MerchMove & { show?: ShowRef })[]
  sales: (MerchSale & { show?: ShowRef })[]
  kits: MerchKit[]
}) {
  const { money, settings } = useMoney()
  const toast = useToast()
  const [preset, setPreset] = useState<Preset>('This year')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [view, setView] = useState<'shows' | 'items'>('shows')

  const period = periodFor(preset, from, to)
  const periodLabel = preset === 'Custom'
    ? `${period.from ? formatDateDMY(period.from) : 'Start'} to ${period.to ? formatDateDMY(period.to) : 'today'}`
    : preset
  const report = buildMerchReport({ items, variants, moves, sales, kits, period })
  const rows = view === 'shows' ? report.byShow : report.byItem
  const t = report.totals

  const csv = () => {
    download(reportCsv(report, view), `${APP_SLUG}-merch-${view}-${todayISO()}.csv`)
    toast('CSV downloaded', 'success')
  }
  const pdf = () => {
    buildMerchReportPdf(report, periodLabel, settings.currency)
    toast('PDF downloaded', 'success')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => <Chip key={p} active={preset === p} onClick={() => setPreset(p)}>{p}</Chip>)}
      </div>
      {preset === 'Custom' && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <Input type="date" aria-label="From" value={from} onChange={e => setFrom(e.target.value)} />
          <Input type="date" aria-label="To" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Money taken" value={money(t.taken)} sub={t.pending ? `${money(t.pending)} waiting` : `${t.sold} sold`} />
        <Stat label="Cost of goods" value={money(t.cost)} sub={t.costMissing ? 'some costs missing' : 'at average cost'} warn={t.costMissing} />
        <Stat label="Given / missing" value={money(t.writeOff)} sub={`${t.given + t.lost} units`} />
        <Stat label="Profit" value={`${t.profit < 0 ? '−' : ''}${money(t.profit)}`} sub={t.taken ? `${Math.round((t.profit / t.taken) * 100)}% of takings` : periodLabel} tone={t.profit < 0 ? 'neg' : 'pos'} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Chip active={view === 'shows'} onClick={() => setView('shows')}>By show</Chip>
          <Chip active={view === 'items'} onClick={() => setView('items')}>By item</Chip>
        </div>
        <div className="flex gap-2">
          <ReasonButton variant="secondary" size="sm" onClick={csv} blocked={!rows.length ? 'Nothing to download for this period.' : null}><Download className="h-4 w-4" />CSV</ReasonButton>
          <ReasonButton variant="secondary" size="sm" onClick={pdf} blocked={!report.byShow.length && !report.byItem.length ? 'Nothing to download for this period.' : null}><FileText className="h-4 w-4" />PDF</ReasonButton>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">Nothing sold, given away or lost in this period.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-brand-200 bg-white shadow-sm">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-bold">{view === 'shows' ? 'Show' : 'Item'}</th>
                <th className="px-2 py-2 text-right font-bold">Sold</th>
                <th className="px-2 py-2 text-right font-bold">{view === 'shows' ? 'Taken' : 'List price'}</th>
                <th className="px-2 py-2 text-right font-bold">Cost</th>
                <th className="px-2 py-2 text-right font-bold">Given / lost</th>
                <th className="px-4 py-2 text-right font-bold">Profit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => <Row key={r.key} r={r} view={view} money={money} />)}
            </tbody>
          </table>
        </div>
      )}
      {t.costMissing && <p className="text-xs text-amber-600">Some items have no restock cost, so their cost counts as zero and profit is higher than it really is. Log restocks with a total cost to fix this.</p>}
      {view === 'items' && <p className="text-xs text-gray-500">Items are counted at list price, since money is taken per sale, not per item. Discounts show up in the By show view.</p>}
    </div>
  )
}

function Row({ r, view, money }: { r: ReportRow; view: 'shows' | 'items'; money: (n: number) => string }) {
  const discount = view === 'shows' ? r.listValue - r.taken : 0
  return (
    <tr className="border-t border-brand-100">
      <td className="px-4 py-2">
        <span className="block font-semibold text-gray-900">{r.label}</span>
        <span className="block text-[11px] text-gray-500">
          {[r.date && formatDateDMY(r.date), r.pending ? `${money(r.pending)} waiting` : null, discount > 0.5 ? `${money(discount)} under list` : discount < -0.5 ? `${money(-discount)} over list` : null].filter(Boolean).join(' · ')}
        </span>
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-gray-900">{r.sold}</td>
      <td className="px-2 py-2 text-right tabular-nums text-gray-900">{money(view === 'shows' ? r.taken : r.listValue)}</td>
      <td className={cn('px-2 py-2 text-right tabular-nums', r.costMissing ? 'text-amber-600' : 'text-gray-600')} title={r.costMissing ? 'Some units have no cost recorded' : undefined}>
        {money(r.cost)}{r.costMissing && '*'}
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-gray-600">{r.given + r.lost ? <>{r.given + r.lost}<span className="block text-[11px]">{money(r.writeOff)}</span></> : '—'}</td>
      <td className={cn('px-4 py-2 text-right font-semibold tabular-nums', r.profit < 0 ? 'text-red-700' : 'text-brand-400 dark:text-emerald-400')}>
        {r.profit < 0 ? '−' : ''}{money(r.profit)}
      </td>
    </tr>
  )
}

function Stat({ label, value, sub, warn, tone }: { label: string; value: string; sub: string; warn?: boolean; tone?: 'pos' | 'neg' }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-brand-200 bg-white px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
      <p className="truncate text-[11px] font-semibold text-gray-500 sm:text-xs">{label}</p>
      <p className={cn('mt-0.5 truncate text-lg font-bold tabular-nums sm:text-xl', tone === 'neg' ? 'text-red-700' : tone === 'pos' ? 'text-brand-400 dark:text-emerald-400' : 'text-gray-900')}>{value}</p>
      <p className={cn('break-words text-[11px] leading-snug sm:text-xs', warn ? 'font-semibold text-amber-600' : 'text-gray-500')}>{sub}</p>
    </div>
  )
}
