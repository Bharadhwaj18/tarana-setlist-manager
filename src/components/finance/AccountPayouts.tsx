'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Landmark } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toaster'
import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { markPendingPaymentPaid } from '@/actions/pending-payments'
import type { PendingPayment } from '@/types'

interface Profile { id: string; display_name: string | null }
interface AccountInfo { id: string; name: string }

const labelCls = 'mb-1.5 block text-xs font-bold text-gray-700'
const inputCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400'

/**
 * "Mark paid" for one waiting payment. The payer (or a treasurer) can add a UPI or bank reference; the person being
 * paid just confirms they got it. Either way it counts for everyone.
 */
function MarkPaidButton({ payment, payerName, payeeName, mode, label }: {
  payment: PendingPayment; payerName: string; payeeName: string; mode: 'payer' | 'receiver'; label: string
}) {
  const { money: fmt } = useMoney()
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reference, setReference] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = () => {
    startTransition(async () => {
      const res = await markPendingPaymentPaid(payment.id, reference)
      if (res.error) { toast(res.error, 'error'); return }
      toast('Marked as paid', 'success')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button size="sm" variant={mode === 'receiver' ? 'primary' : 'secondary'} onClick={() => setOpen(true)}>{label}</Button>
      <Modal open={open} onOpenChange={setOpen} title={mode === 'receiver' ? 'Did you get it?' : `Mark ${payeeName} paid`} className="max-w-[440px] rounded-2xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900">{mode === 'receiver' ? payerName : payeeName}</p>
              <p className="truncate text-xs text-gray-500">{payment.description}</p>
            </div>
            <p className="shrink-0 text-lg font-extrabold tabular-nums">{fmt(payment.amount)}</p>
          </div>
          {mode === 'payer' ? (
            <div>
              <label htmlFor="payout-ref" className={labelCls}>UPI or bank reference <span className="font-normal text-gray-500">(optional)</span></label>
              <input id="payout-ref" value={reference} maxLength={80} onChange={e => setReference(e.target.value)} placeholder="UPI 4821 7790" className={inputCls} />
              <p className="mt-1.5 text-xs text-gray-500">So everyone can trace it later.</p>
            </div>
          ) : (
            <p className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-gray-600">
              This marks it paid for everyone: {payerName} goes down by {fmt(payment.amount)} and the treasurer is told.
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{mode === 'receiver' ? 'Not yet' : 'Cancel'}</Button>
            <Button type="button" loading={pending} onClick={submit}>{mode === 'receiver' ? `Yes, I got ${fmt(payment.amount)}` : 'Mark paid'}</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

/** For treasurers: everything waiting to be paid out of a band account, with one-by-one or all-at-once marking. */
export function AccountPayouts({ payments, accounts, profiles }: { payments: PendingPayment[]; accounts: AccountInfo[]; profiles: Profile[] }) {
  const { money: fmt } = useMoney()
  const router = useRouter()
  const toast = useToast()
  const [busy, startTransition] = useTransition()
  const nameOf = (id: string) => profiles.find(p => p.id === id)?.display_name ?? 'Member'
  if (payments.length === 0) return null

  const groups = [...new Set(payments.map(p => p.from_account))].map(id => {
    const items = payments.filter(p => p.from_account === id)
    return { id, name: accounts.find(a => a.id === id)?.name ?? 'Account', items, total: Math.round(items.reduce((s, p) => s + p.amount, 0) * 100) / 100 }
  })

  const markAll = (ids: string[]) => {
    startTransition(async () => {
      for (const id of ids) {
        const res = await markPendingPaymentPaid(id)
        if (res.error) { toast(res.error, 'error'); router.refresh(); return }
      }
      toast('Marked as paid', 'success')
      router.refresh()
    })
  }

  return (
    <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
      <h2 className="font-sans text-sm font-extrabold">Waiting to be paid from accounts · {payments.length} payout{payments.length !== 1 ? 's' : ''}</h2>
      {groups.map(g => (
        <div key={g.id} className="overflow-hidden rounded-xl bg-white text-gray-800">
          <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3.5 py-2.5 text-xs font-extrabold text-gray-600">
            <Landmark className="h-4 w-4" />
            <span className="flex-1 truncate">{g.name}</span>
            <span className="tabular-nums text-gray-900">{fmt(g.total)}</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {g.items.map(p => (
              <li key={p.id} className="flex items-center gap-3 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{nameOf(p.to_member)}</p>
                  <p className="truncate text-xs text-gray-500">{p.description}</p>
                </div>
                <span className="shrink-0 text-sm font-extrabold tabular-nums">{fmt(p.amount)}</span>
                <MarkPaidButton payment={p} payerName={g.name} payeeName={nameOf(p.to_member)} mode="payer" label="Mark paid" />
              </li>
            ))}
          </ul>
          {g.items.length > 1 && (
            <div className="border-t border-gray-100 p-2.5">
              <Button size="sm" className="w-full" loading={busy} onClick={() => markAll(g.items.map(p => p.id))}>
                <Check className="h-4 w-4" />Mark all paid · {fmt(g.total)}
              </Button>
            </div>
          )}
        </div>
      ))}
      <p className="text-xs font-semibold opacity-80">Make each transfer in your bank or UPI app first. The app doesn’t move money itself. The person being paid can also tap “I got it”.</p>
    </section>
  )
}

/** For anyone waiting to be paid: what's owed to them, with a way to say they got it. */
export function OwedToYou({ payments, accounts, profiles }: { payments: PendingPayment[]; accounts: AccountInfo[]; profiles: Profile[] }) {
  const { money: fmt } = useMoney()
  const nameOf = (id: string | null) => profiles.find(p => p.id === id)?.display_name ?? 'Member'
  if (payments.length === 0) return null
  const total = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100
  const payerName = (p: PendingPayment) => p.from_account ? (accounts.find(a => a.id === p.from_account)?.name ?? 'Account') : nameOf(p.from_member)

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
      <h2 className="mb-3 font-sans text-sm font-extrabold">Owed to you {fmt(total)}</h2>
      <div className="space-y-2">
        {payments.map(p => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white px-3.5 py-3 text-gray-800">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{payerName(p)} · {fmt(p.amount)}</p>
              <p className="truncate text-xs text-gray-500">{p.category === 'balance_reimbursement' ? 'Balance reimbursement' : p.description}</p>
            </div>
            <MarkPaidButton payment={p} payerName={payerName(p)} payeeName="you" mode="receiver" label="I got it" />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs font-semibold opacity-80">Got the money already? Tap “I got it” and it’s marked paid for everyone.</p>
    </section>
  )
}
