'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Scale } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toaster'
import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { checkAccountBalance } from '@/actions/finance-checks'
import { balanceDifference, daysSince, type BalanceCheck, type CheckState } from '@/lib/finance/reconcile'
import { cn } from '@/lib/utils'

const labelCls = 'mb-1.5 block text-xs font-bold text-gray-700'
const inputCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

/** A short line about when the account was last matched against the bank. */
export function checkStatusText(state: CheckState, last: BalanceCheck | undefined, today: string): string {
  if (!last) return 'Not checked against the bank yet'
  const ago = daysSince(last.checkedOn, today)
  const when = ago === 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`
  if (state === 'stale') return `Last checked ${when}`
  if (state === 'matched') return `Matched the bank ${when}`
  if (state === 'fixed') return `Corrected to match the bank ${when}`
  return `Was off from the bank ${when}`
}

const STATE_STYLE: Record<CheckState, string> = {
  matched: 'bg-emerald-50 text-emerald-800',
  fixed: 'bg-emerald-50 text-emerald-800',
  off: 'bg-amber-50 text-amber-900',
  stale: 'bg-amber-50 text-amber-900',
  never: 'bg-gray-100 text-gray-600',
}

export function CheckChip({ state, last, today }: { state: CheckState; last: BalanceCheck | undefined; today: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', STATE_STYLE[state])}>
      {(state === 'matched' || state === 'fixed') && <CheckCircle2 className="h-3.5 w-3.5" />}
      {checkStatusText(state, last, today)}
    </span>
  )
}

/** "Check against bank": type what the bank shows, see the difference, then record it or fix the balance. */
export function CheckBalanceButton({ accountId, accountName, recorded, today }: { accountId: string; accountName: string; recorded: number; today: string }) {
  const { canApprove } = useMoney()
  const [open, setOpen] = useState(false)
  if (!canApprove) return null
  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Scale className="h-4 w-4" />Check against bank
      </Button>
      <Modal open={open} onOpenChange={setOpen} title="Check against bank" className="max-w-[440px] rounded-2xl">
        {open && <CheckForm accountId={accountId} accountName={accountName} recorded={recorded} today={today} onDone={() => setOpen(false)} />}
      </Modal>
    </>
  )
}

function CheckForm({ accountId, accountName, recorded, today, onDone }: { accountId: string; accountName: string; recorded: number; today: string; onDone: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const { money, symbol } = useMoney()
  const [bank, setBank] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  const value = parseFloat(bank)
  const entered = bank.trim() !== '' && Number.isFinite(value)
  const diff = entered ? balanceDifference(value, recorded) : 0

  const save = (adjust: boolean) => {
    startTransition(async () => {
      const res = await checkAccountBalance({ accountId, bank: value, note, date, adjust })
      if (res.error) { toast(res.error, 'error'); return }
      toast(adjust && diff !== 0 ? 'Balance corrected' : diff === 0 ? 'Matches the bank' : 'Check saved', 'success')
      router.refresh()
      onDone()
    })
  }

  return (
    <form onSubmit={e => { e.preventDefault(); if (entered && diff === 0) save(false) }} className="space-y-4">
      <p className="text-sm leading-relaxed text-gray-600">Open your bank or UPI app and type the balance it shows for {accountName}. We’ll compare it with what’s recorded here.</p>
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3">
        <span className="text-xs font-bold text-gray-600">Recorded here</span>
        <span className="text-base font-extrabold tabular-nums text-gray-900">{money(recorded)}</span>
      </div>
      <div>
        <label htmlFor="bank-balance" className={labelCls}>Bank shows</label>
        <div className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-400">
          <span className="font-bold text-gray-500">{symbol}</span>
          <input id="bank-balance" type="number" inputMode="decimal" step="any" autoFocus value={bank} onChange={e => setBank(e.target.value)}
            placeholder="0" className="min-h-11 w-full bg-transparent text-sm font-bold text-gray-900 outline-none" />
        </div>
      </div>

      {entered && (
        diff === 0 ? (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />It matches. Nothing to fix.
          </p>
        ) : (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm font-semibold leading-relaxed text-amber-900">
            {diff > 0 ? `The bank has ${money(diff)} more than recorded.` : `The bank has ${money(-diff)} less than recorded.`}{' '}
            Look for a payment or deposit nobody added. If you can’t find one, fix the balance to match the bank.
          </p>
        )
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="bank-date" className={labelCls}>As of</label>
          <input id="bank-date" type="date" max={today} value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="bank-note" className={labelCls}>Note <span className="font-normal text-gray-500">(optional)</span></label>
          <input id="bank-note" value={note} maxLength={120} onChange={e => setNote(e.target.value)} placeholder="Bank fee not logged" className={inputCls} />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        {entered && diff !== 0 ? (
          <>
            <Button type="button" variant="secondary" loading={pending} onClick={() => save(false)}>Just record it</Button>
            <Button type="button" loading={pending} onClick={() => save(true)}>Fix balance by {money(Math.abs(diff))}</Button>
          </>
        ) : (
          <Button type="submit" loading={pending} disabled={!entered}>Save check</Button>
        )}
      </div>
    </form>
  )
}

/** Past checks for one account, newest first. */
export function CheckHistory({ checks, nameById }: { checks: BalanceCheck[]; nameById: Record<string, string> }) {
  const { money } = useMoney()
  if (checks.length === 0) return null
  return (
    <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-200 bg-white">
      {checks.map(c => (
        <li key={c.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-900">
              {c.difference === 0 ? 'Matched the bank' : c.corrected ? 'Corrected to match the bank' : `Off by ${money(Math.abs(c.difference))}, left as is`}
            </p>
            <p className="truncate text-xs text-gray-500">{c.checkedOn} · {nameById[c.checkedBy] ?? 'A member'}{c.note ? ` · ${c.note}` : ''}</p>
          </div>
          <span className="shrink-0 text-sm font-extrabold tabular-nums text-gray-900">{money(c.bank)}</span>
        </li>
      ))}
    </ul>
  )
}
