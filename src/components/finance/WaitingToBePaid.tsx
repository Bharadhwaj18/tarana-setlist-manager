'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Hourglass } from 'lucide-react'
import { markFeeReceived } from '@/actions/finance-settings'
import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { useToast } from '@/components/ui/Toaster'
import { daysUntil } from '@/lib/dates'
import { todayISO } from '@/lib/shows'

interface WaitingShow { id: string; title: string; date: string; fee: number; received: number }

function shortDate(iso: string) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'))
}

/** Past shows whose fee hasn't been marked received, oldest first, so nothing is forgotten. */
export function WaitingToBePaid({ shows }: { shows: WaitingShow[] }) {
  const { money } = useMoney()
  const router = useRouter()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const today = todayISO()
  const total = shows.reduce((sum, s) => sum + Math.max(0, s.fee - s.received), 0)

  const markPaid = (id: string) => {
    startTransition(async () => {
      const res = await markFeeReceived(id)
      if (res.error) { toast(res.error, 'error'); return }
      toast('Marked as paid', 'success')
      router.refresh()
    })
  }

  return (
    <section className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 font-sans text-sm font-extrabold text-gray-900">
          <Hourglass className="h-4 w-4 text-amber-600" /> Waiting to be paid
        </h2>
        <span className="text-sm font-bold tabular-nums text-gray-900">{money(total)}</span>
      </div>
      <ul className="divide-y divide-brand-100">
        {shows.map(s => {
          const days = -daysUntil(s.date, today)
          const left = Math.max(0, s.fee - s.received)
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <div className="min-w-0 flex-1">
                <Link href={`/shows/${s.id}`} className="block truncate text-sm font-semibold text-gray-900 hover:text-brand-700">{s.title}</Link>
                <p className="text-xs text-gray-500">
                  Played {shortDate(s.date)} · {days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`}
                  {s.received > 0 && ` · ${money(s.received)} of ${money(s.fee)} in`}
                </p>
              </div>
              <span className="text-sm font-bold tabular-nums text-amber-700">{money(left)}</span>
              <button type="button" disabled={pending} onClick={() => markPaid(s.id)}
                className="rounded-lg bg-brand-100 px-3 py-1.5 text-xs font-bold text-gray-800 hover:bg-brand-200 disabled:opacity-50">
                Mark paid
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
