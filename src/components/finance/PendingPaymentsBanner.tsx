'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { markPendingPaymentPaid } from '@/actions/pending-payments'
import { useToast } from '@/components/ui/Toaster'
import type { PendingPayment } from '@/types'

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

interface Props {
  /** Already filtered to the current user's own pending payments (from_member === them). */
  payments: PendingPayment[]
  nameOf: (id: string) => string
}

/**
 * A standing reminder for whatever this person still owes a bandmate from
 * a confirmed split — shown until they mark it paid, at which point it
 * becomes a real Band Fund debit (see markPendingPaymentPaid). No push
 * notifications here — this banner (plus the Sidebar badge) is the
 * reminder, and it's there every time they open the app until it's dealt
 * with.
 */
export function PendingPaymentsBanner({ payments, nameOf }: Props) {
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  if (payments.length === 0) return null

  const handleMarkPaid = (id: string) => {
    startTransition(async () => {
      const result = await markPendingPaymentPaid(id)
      if (result.error) toast(result.error, 'error')
      else toast('Marked as paid', 'success')
    })
  }

  const total = round2(payments.reduce((s, p) => s + p.amount, 0))

  return (
    <section className="rounded-xl border border-red-200 bg-red-50 p-4">
      <h2 className="mb-3 text-sm font-semibold text-red-800">
        You owe {fmt(total)} · {payments.length} pending payment{payments.length !== 1 ? 's' : ''}
      </h2>
      <div className="space-y-2">
        {payments.map(p => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2.5 shadow-sm">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-800">{nameOf(p.to_member)}</p>
              <p className="truncate text-xs text-gray-400">{p.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm font-bold text-gray-800">{fmt(p.amount)}</span>
              <Button size="sm" loading={isPending} onClick={() => handleMarkPaid(p.id)}>Mark paid</Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
