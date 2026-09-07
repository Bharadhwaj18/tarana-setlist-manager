'use client'

import { useState, useTransition } from 'react'
import { Download } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { exportTransactions } from '@/actions/finance'
import { useToast } from '@/components/ui/Toaster'
import { buildTransactionStatementPdf } from '@/lib/pdf/financeReports'

interface Member { id: string; name: string }

const PRESETS = [
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last year', days: 365 },
  { label: 'All time', days: 0 },
  { label: 'Custom', days: -1 },
] as const

type Preset = typeof PRESETS[number]['label']

function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() - n); return r }

const inputCls = 'w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

export function ExportModal({ members }: { members: Member[] }) {
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState<Preset>('Last 30 days')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [memberId, setMemberId] = useState<string>('all')
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const getFilters = () => {
    const today = new Date()
    const p = PRESETS.find(x => x.label === preset)!
    if (preset === 'Custom') {
      return { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, memberId }
    }
    if (p.days === 0) return { memberId }  // all time
    return { dateFrom: toDateStr(addDays(today, p.days)), dateTo: toDateStr(today), memberId }
  }

  const memberLabel = (id: string) =>
    id === 'all' ? 'All members' : id === 'fund' ? 'Band fund' : (members.find(m => m.id === id)?.name ?? id)

  const handleExport = () => {
    startTransition(async () => {
      const filters = getFilters()
      const result = await exportTransactions(filters)
      if (result.error || !result.data) {
        toast(result.error ?? 'Export failed', 'error')
        return
      }

      const rows = result.data
      if (rows.length === 0) {
        toast('No transactions found for this range', 'error')
        return
      }

      if (format === 'csv') {
        const header = 'Date,Member,Description,Amount'
        const lines = rows.map(r =>
          [r.date, `"${r.member}"`, `"${r.description.replace(/"/g, '""')}"`, r.amount].join(',')
        )
        const csv = [header, ...lines].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `tarana-finance-${toDateStr(new Date())}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast('CSV downloaded', 'success')
        setOpen(false)
      } else {
        buildTransactionStatementPdf(rows, preset, memberLabel(memberId))
        toast('PDF downloaded', 'success')
        setOpen(false)
      }
    })
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Download className="h-4 w-4" /> Export
      </Button>

      <Modal open={open} onOpenChange={setOpen} title="Export Transactions">
        <div className="space-y-4">
          {/* Date range */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Date range</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setPreset(p.label)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    preset === p.label ? 'bg-brand-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {preset === 'Custom' && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
                </div>
              </div>
            )}
          </div>

          {/* Member filter */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Member</label>
            <select value={memberId} onChange={e => setMemberId(e.target.value)} className={inputCls}>
              <option value="all">All members</option>
              <option value="fund">Band fund only</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {/* Format */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Format</label>
            <div className="flex gap-2">
              {(['csv', 'pdf'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 rounded-md py-2 text-sm font-semibold uppercase transition-colors ${
                    format === f ? 'bg-brand-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleExport} loading={isPending}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
