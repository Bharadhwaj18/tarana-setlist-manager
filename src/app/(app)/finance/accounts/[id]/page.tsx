import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Banknote, ChevronLeft, Landmark } from 'lucide-react'
import { sectionGuard } from '@/lib/section-guard'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspaceId } from '@/lib/workspace'
import { getCachedAllProfiles, getCachedFinanceAccounts, getCachedFinanceSettings, getCachedFinanceProjects, getCachedUser } from '@/lib/data'
import { accountValue } from '@/lib/finance/accounts'
import { categoryLabel } from '@/lib/finance/settings'
import { FinanceExtrasProvider } from '@/components/finance/FinanceSettingsContext'
import { AddTransactionModal } from '@/components/finance/AddTransactionModal'
import { TransactionRow } from '@/components/finance/TransactionRow'
import { fmtSigned } from '@/components/finance/money'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { cn } from '@/lib/utils'

interface Props { params: Promise<{ id: string }> }

/** One account: what it holds, and every entry that touched it, newest first, with the balance after each. */
export default async function AccountPage({ params }: Props) {
  const denied = await sectionGuard('finance')
  if (denied) return denied
  const { id } = await params
  const supabase = await createClient()
  const ws = await requireWorkspaceId()

  const [settings, allAccounts, profiles, { data: { user } }, projects, { data: txns }, { data: shows }, { data: budgets }] = await Promise.all([
    getCachedFinanceSettings(),
    getCachedFinanceAccounts(),
    getCachedAllProfiles(),
    getCachedUser(),
    getCachedFinanceProjects(),
    supabase.from('finance_transactions').select('*').eq('workspace_id', ws).eq('account_id', id).order('created_at', { ascending: true }),
    supabase.from('shows').select('*').eq('workspace_id', ws),
    supabase.from('budgets').select('*').eq('workspace_id', ws).order('created_at', { ascending: true }),
  ])
  const account = allAccounts.find(a => a.id === id)
  if (!settings.features.accounts || !account) notFound()

  const currency = settings.currency
  const accounts = allAccounts
  const nameById = Object.fromEntries(profiles.map(p => [p.id, p.id === user?.id ? 'You' : (p.display_name ?? 'Member')]))
  const members = profiles.map(p => ({ id: p.id, name: nameById[p.id], isYou: p.id === user?.id })).sort((a, b) => Number(b.isYou) - Number(a.isYou))
  const showTitleById = Object.fromEntries((shows ?? []).map(s => [s.id, s.title]))

  // Oldest first for the running balance, then shown newest first.
  const withBalance: { t: NonNullable<typeof txns>[number]; after: number }[] = []
  let running = 0
  for (const t of txns ?? []) {
    running = Math.round((running + t.amount) * 100) / 100
    withBalance.push({ t, after: running })
  }
  const balance = running
  const rows = [...withBalance].reverse()
  const Icon = account.kind === 'cash' ? Banknote : Landmark

  return (
    <FinanceExtrasProvider projects={projects} knownTags={[...new Set((txns ?? []).flatMap(t => t.tags ?? []))]} accounts={accounts}>
      <div className="space-y-5">
        <Link href="/finance" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-700"><ChevronLeft className="h-4 w-4" /> Finance</Link>

        <section className="rounded-2xl bg-hero p-5 text-hero-fg">
          <p className="flex items-center gap-2 text-sm font-bold opacity-85">
            <Icon className="h-4 w-4" />{account.name} · {account.heldBy ? `held by ${nameById[account.heldBy] ?? 'a member'}` : 'held by the band'}
            {account.archived && <span className="rounded-full bg-hero-fg/15 px-2 py-0.5 text-xs">Archived</span>}
          </p>
          <p className={cn('mt-2 font-display text-4xl font-bold tabular-nums', balance < 0 && 'text-red-200')}>{fmtSigned(balance, currency)}</p>
          {account.upiId && <p className="mt-1 text-xs font-semibold opacity-80">UPI {account.upiId}</p>}
          {!account.archived && (
            <div className="mt-4">
              <AddTransactionModal presetHolder={accountValue(account.id)} members={members} shows={shows ?? []} budgets={budgets ?? []} />
            </div>
          )}
        </section>

        <section>
          <SectionLabel className="mb-3">This account</SectionLabel>
          {rows.length === 0 ? (
            <EmptyState title="Nothing in this account yet" description="Add money in with a show fee or a top-up, and it appears here." />
          ) : (
            <div className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-200 bg-white">
              {rows.map(({ t, after }) => (
                <TransactionRow
                  key={t.id}
                  transaction={t}
                  members={members}
                  shows={shows ?? []}
                  budgets={budgets ?? []}
                  payerName={`Added by ${nameById[t.recorded_by] ?? 'a member'}`}
                  afterMemberBalance={after}
                  badge={t.show_id && showTitleById[t.show_id] ? { label: showTitleById[t.show_id], kind: 'show' } : t.category ? { label: categoryLabel(settings, t.category), kind: 'category' } : undefined}
                />
              ))}
            </div>
          )}
          <p className="mt-2 px-1 text-xs text-gray-500">The grey number under each entry is the balance after it.</p>
        </section>
      </div>
    </FinanceExtrasProvider>
  )
}
