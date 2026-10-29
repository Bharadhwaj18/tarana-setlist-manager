import Link from 'next/link'
import { Banknote, ChevronRight, Landmark, Plus, Settings2 } from 'lucide-react'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { DEBIT_TEXT, fmtSigned } from '@/components/finance/money'
import { cn } from '@/lib/utils'
import type { FinanceAccount } from '@/lib/finance/accounts'
import { MoveMoneyButton } from '@/components/finance/MoveMoneyButton'

interface Props {
  accounts: FinanceAccount[]
  balances: Record<string, number>
  /** Member display names by id, for "held by". */
  nameById: Record<string, string>
  currency: string
  /** Owners and admins: can reach account settings. */
  canManage: boolean
  members: { id: string; name: string; isYou?: boolean }[]
}

/** "Where the money is": the band's real accounts, each opening its own page. */
export function AccountsCard({ accounts, balances, nameById, currency, canManage, members }: Props) {
  // Archived accounts leave the list unless they still hold something, so the total always adds up.
  const shown = accounts.filter(a => !a.archived || (balances[a.id] ?? 0) !== 0)

  return (
    <section aria-label="Where the money is" className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionLabel>Where the money is</SectionLabel>
        <div className="flex items-center gap-2">
          {shown.length > 0 && <MoveMoneyButton accounts={accounts} members={members} balances={balances} variant="ghost" />}
          {canManage && shown.length > 0 && (
            <Link href="/settings/money" className="inline-flex items-center gap-1 text-sm font-extrabold text-brand-600 hover:underline">
              <Settings2 className="h-3.5 w-3.5" />Manage
            </Link>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-brand-200 p-4 text-center">
          <p className="text-sm text-gray-600">Add the band’s bank account or cash box, so you can see where the money actually is.</p>
          {canManage && (
            <Link href="/settings/money" className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-extrabold text-white hover:bg-brand-700">
              <Plus className="h-4 w-4" />Make an account
            </Link>
          )}
        </div>
      ) : (
        <ul className="-mx-2 divide-y divide-brand-100">
          {shown.map(a => {
            const balance = balances[a.id] ?? 0
            const Icon = a.kind === 'cash' ? Banknote : Landmark
            return (
              <li key={a.id}>
                <Link href={`/finance/accounts/${a.id}`} className="flex min-h-16 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-brand-50">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-extrabold text-gray-900">{a.name}{a.archived && <span className="ml-2 text-xs font-bold text-gray-400">Archived</span>}</span>
                    <span className="block truncate text-xs font-semibold text-gray-500">{a.heldBy ? `Held by ${nameById[a.heldBy] ?? 'a member'}` : 'Held by the band'}</span>
                  </span>
                  <span className={cn('shrink-0 text-base font-extrabold tabular-nums', balance < 0 ? DEBIT_TEXT : 'text-gray-900')}>{fmtSigned(balance, currency)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
