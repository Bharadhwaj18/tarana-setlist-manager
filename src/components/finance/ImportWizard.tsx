'use client'

import { useState, useTransition, useRef } from 'react'
import { Upload, AlertCircle, CheckCircle } from 'lucide-react'
import { importTransactions } from '@/actions/finance'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { useRouter } from 'next/navigation'

interface ParsedRow {
  serial: string
  date: string
  description: string
  amount: number
  runningBalance: number
  raw: string[]
}

type Step = 'upload' | 'preview' | 'done'

const inputCls = 'w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

function parseAmount(credit: string, debit: string): number {
  const c = parseFloat(credit?.replace(/,/g, '') ?? '') || 0
  const d = parseFloat(debit?.replace(/,/g, '') ?? '') || 0
  return c - d
}

function parseDate(raw: string): string {
  if (!raw?.trim()) return ''
  const cleaned = raw.trim()
  // Try common date formats
  const parsed = new Date(cleaned)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return ''
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  for (const line of lines) {
    const cols: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        cols.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    cols.push(current.trim())
    rows.push(cols)
  }
  return rows
}

// Detect column indices by matching headers
function detectColumns(header: string[]): { slno: number; date: number; remarks: number; credit: number; debit: number; balance: number } {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  const find = (...keys: string[]) => {
    for (const k of keys) {
      const idx = header.findIndex(h => norm(h).includes(k))
      if (idx >= 0) return idx
    }
    return -1
  }
  return {
    slno: find('sl', 'no', 'serial'),
    date: find('date'),
    remarks: find('remark', 'desc', 'narrat', 'particular'),
    credit: find('credit', 'income', 'cr'),
    debit: find('debit', 'expense', 'dr'),
    balance: find('balance', 'bal'),
  }
}

export function ImportWizard() {
  const [step, setStep] = useState<Step>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [defaultDate, setDefaultDate] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState(0)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const router = useRouter()

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const grid = parseCsv(text)
      if (grid.length < 2) {
        setError('File appears empty or has only one row.')
        return
      }

      const header = grid[0]
      const cols = detectColumns(header)

      if (cols.remarks < 0 || (cols.credit < 0 && cols.debit < 0)) {
        setError(`Could not detect columns. Expected headers: REMARKS (or Description), CREDIT, DEBIT. Found: ${header.join(', ')}`)
        return
      }

      // Forward-fill dates
      let lastDate = ''
      const parsed: ParsedRow[] = []
      for (let i = 1; i < grid.length; i++) {
        const row = grid[i]
        if (!row.some(c => c.trim())) continue  // skip blank rows

        const rawDate = cols.date >= 0 ? row[cols.date] : ''
        const parsedD = parseDate(rawDate)
        if (parsedD) lastDate = parsedD
        const date = parsedD || lastDate

        const description = cols.remarks >= 0 ? row[cols.remarks] : row[0]
        if (!description?.trim()) continue

        const creditStr = cols.credit >= 0 ? row[cols.credit] : ''
        const debitStr = cols.debit >= 0 ? row[cols.debit] : ''
        const amount = parseAmount(creditStr, debitStr)
        if (amount === 0) continue

        const balStr = cols.balance >= 0 ? row[cols.balance] : ''
        const runningBalance = parseFloat(balStr?.replace(/,/g, '') ?? '') || 0

        parsed.push({
          serial: cols.slno >= 0 ? (row[cols.slno] ?? String(i)) : String(i),
          date,
          description: description.trim(),
          amount,
          runningBalance,
          raw: row,
        })
      }

      if (parsed.length === 0) {
        setError('No valid rows found. Check that the file has REMARKS/Description, CREDIT, and DEBIT columns.')
        return
      }

      setRows(parsed)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  const undatedCount = rows.filter(r => !r.date).length

  const handleImport = () => {
    const toImport = rows.map(r => ({
      date: r.date || defaultDate,
      description: r.description,
      amount: r.amount,
    }))

    startTransition(async () => {
      const result = await importTransactions(toImport)
      if (result.error) {
        toast(result.error, 'error')
        return
      }
      setImportedCount(result.imported)
      setStep('done')
    })
  }

  if (step === 'done') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <CheckCircle className="mx-auto mb-3 h-10 w-10 text-green-500" />
        <h2 className="text-lg font-semibold text-green-800">Import complete</h2>
        <p className="mt-1 text-sm text-green-600">{importedCount} transactions imported to band fund.</p>
        <Button className="mt-5" onClick={() => router.push('/finance')}>
          View Finance →
        </Button>
      </div>
    )
  }

  if (step === 'preview') {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            <p className="text-sm text-gray-500">{rows.length} transactions detected · all imported as Band Fund</p>
          </div>
          <button onClick={() => { setStep('upload'); setRows([]); if (fileRef.current) fileRef.current.value = '' }}
            className="text-xs text-gray-400 hover:text-gray-600 underline">
            Change file
          </button>
        </div>

        {undatedCount > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800">{undatedCount} rows have no date</p>
                <p className="text-xs text-amber-600 mt-0.5">Choose a fallback date for undated rows:</p>
                <input type="date" value={defaultDate} onChange={e => setDefaultDate(e.target.value)}
                  className="mt-2 rounded-md border border-amber-300 bg-white px-2 py-1 text-sm focus:border-amber-500 focus:outline-none" />
              </div>
            </div>
          </div>
        )}

        {/* Preview table — first 20 rows */}
        <div className="overflow-x-auto rounded-xl border border-brand-200">
          <table className="min-w-full text-sm">
            <thead className="bg-brand-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Date</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {rows.slice(0, 20).map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                    {r.date || <span className="italic text-amber-500">{defaultDate} (fallback)</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-800 max-w-xs truncate">{r.description}</td>
                  <td className={`px-4 py-2 text-right font-semibold tabular-nums ${r.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {r.amount >= 0 ? '+' : '−'}₹{Math.abs(r.amount).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 20 && (
            <p className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-t border-brand-100">
              … and {rows.length - 20} more rows
            </p>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-green-800">{rows.length} transactions to import</p>
            <p className="text-xs text-green-600">All will be recorded as Band Fund transactions</p>
          </div>
          <Button onClick={handleImport} loading={isPending}>
            Import All →
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Transactions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload a CSV exported from Excel. Columns needed: <strong>Date</strong>, <strong>REMARKS</strong> (or Description), <strong>CREDIT</strong>, <strong>DEBIT</strong>.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-brand-200 p-10 text-center hover:border-brand-400 transition-colors">
        <Upload className="mx-auto mb-3 h-8 w-8 text-gray-300" />
        <p className="text-sm font-medium text-gray-600">Click to upload CSV file</p>
        <p className="mt-1 text-xs text-gray-400">Export your Excel sheet as CSV (File → Save As → CSV)</p>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="sr-only" />
      </label>

      <div className="rounded-lg bg-gray-50 p-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-600">Expected format:</p>
        <p>SL NO | Date | REMARKS | CREDIT | DEBIT | BALANCE</p>
        <p className="mt-1">Dates can be empty — rows will use the most recent dated row or the fallback date you choose.</p>
        <p>All transactions are imported as <strong>Band Fund</strong> entries (member_id = null).</p>
      </div>
    </div>
  )
}
