import { CalendarDays, ListMusic, Users, Wallet } from 'lucide-react'
import { CreateWorkspaceForm } from '@/components/workspace/CreateWorkspaceForm'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'

const GETS = [
  { icon: ListMusic, text: 'Shared songs, chord charts and setlists' },
  { icon: CalendarDays, text: 'Shows, bookings and a shared calendar' },
  { icon: Wallet, text: 'Fees, splits and who owes whom' },
  { icon: Users, text: 'Roles for everyone, with a treasurer if you want one' },
]

export default function NewWorkspacePage() {
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Create a workspace"
        subtitle="Its own songs, setlists, shows and money, for a band, a venue or anything else you run. You’ll be the owner."
      />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm sm:p-6">
          <CreateWorkspaceForm />
        </section>
        <aside className="h-fit rounded-2xl border border-brand-200 bg-white p-5">
          <SectionLabel>What you get</SectionLabel>
          <ul className="mt-3 space-y-3">
            {GETS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-gray-700">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700"><Icon className="h-4 w-4" /></span>
                {text}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
