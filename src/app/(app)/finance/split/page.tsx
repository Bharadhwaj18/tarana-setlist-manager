import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCachedAllProfiles, getCachedUser } from '@/lib/data'
import { SplitWizard } from '@/components/finance/SplitWizard'
import type { FinanceShowExpense } from '@/types/finance'

export default async function SplitPage() {
  const supabase = await createClient()

  const [{ data: { user } }, profiles, { data: shows }, { data: expenses }] = await Promise.all([
    getCachedUser(),
    getCachedAllProfiles(),
    supabase.from('finance_shows').select('*').is('split_at', null).order('show_date', { ascending: false }),
    supabase.from('finance_show_expenses').select('*'),
  ])

  if (!shows?.length) notFound()

  const members = profiles.map(p => ({
    id: p.id,
    name: p.id === user?.id ? 'You' : (p.display_name ?? 'Member'),
  }))

  const expensesByShow: Record<string, FinanceShowExpense[]> = {}
  for (const e of expenses ?? []) {
    if (!expensesByShow[e.show_id]) expensesByShow[e.show_id] = []
    expensesByShow[e.show_id].push(e)
  }

  return (
    <div className="max-w-xl">
      <Link href="/finance" className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Finance
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Split Show Money</h1>
      <SplitWizard shows={shows} members={members} initialExpenses={expensesByShow} />
    </div>
  )
}
