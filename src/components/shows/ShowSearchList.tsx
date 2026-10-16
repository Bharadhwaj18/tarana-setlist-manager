'use client'

import { useMoney } from '@/components/finance/FinanceSettingsContext'
import { useState } from 'react'
import { deleteShow } from '@/actions/shows'
import { LongPressMenu, type MenuItem } from '@/components/ui/LongPressMenu'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, CalendarDays, ListMusic, Pencil, Plus, Trash2 } from 'lucide-react'
import { isUpcoming } from '@/lib/shows'
import { countdownLabel } from '@/lib/dates'
import { SegmentedTabs } from '@/components/ui/Chip'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { StatusPill, type PillTone } from '@/components/ui/StatusPill'
import { DateTile } from '@/components/ui/DateTile'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { BarList, ShowsDashboard, type ShowsInsights } from './ShowsDashboard'
import type { Show } from '@/types'
import { Select } from '@/components/ui/Select'

interface ShowSearchListProps {
  shows: Show[]
  netByShow: Record<string, number>
  setlistByShow: Record<string, { id: string; title: string } | undefined>
  /** Today's date (YYYY-MM-DD), passed from the server so upcoming/past is
   *  decided consistently rather than by the viewer's own clock. */
  today: string
  eventManagementById: Record<string, { id: string; name: string }>
  insights: ShowsInsights
}

type Tab = 'upcoming' | 'played' | 'insights'

const BOOKED = ['Confirmed', 'Advance Received', 'Completed']
const statusTone = (status: string): PillTone => (BOOKED.includes(status) ? 'green' : 'amber')


const monthLabel = (d: string) =>
  new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T00:00:00Z'))

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups: { key: string; items: T[] }[] = []
  for (const item of items) {
    const k = key(item)
    const last = groups[groups.length - 1]
    if (last && last.key === k) last.items.push(item)
    else groups.push({ key: k, items: [item] })
  }
  return groups
}

function ShowRow({ s, net, setlist, today, agency, mode, strong }: {
  s: Show
  net: number
  setlist: { id: string; title: string } | undefined
  today: string
  agency?: string
  mode: 'upcoming' | 'played'
  strong?: boolean
}) {
  const { money: fmt } = useMoney()
  const router = useRouter()
  const isSplit = !!s.split_at
  const meta = [s.venue, agency ? `via ${agency}` : null].filter(Boolean).join(' · ')
  const menu: MenuItem[] = [
    { label: 'Open', href: `/shows/${s.id}`, icon: CalendarDays },
    { label: 'Edit', href: `/shows/${s.id}/edit`, icon: Pencil },
    setlist ? { label: 'Open setlist', href: `/setlists/${setlist.id}`, icon: ListMusic } : { label: 'Add setlist', href: `/setlists/new?showId=${s.id}`, icon: Plus },
    { label: 'Delete', icon: Trash2, danger: true, onSelect: () => { if (window.confirm(`Delete "${s.title}"? This can’t be undone.`)) void deleteShow(s.id).then(r => { if (r?.error) window.alert(r.error); else router.refresh() }) } },
  ]

  return (
    <LongPressMenu title={s.title} items={menu} className="animate-row-in flex flex-col gap-2 rounded-2xl border border-brand-200 bg-white p-3 shadow-sm transition-colors hover:border-brand-300 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
      <Link href={`/shows/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3.5">
        {s.show_date ? (
          <DateTile date={s.show_date} tone={strong ? 'strong' : 'soft'} />
        ) : (
          <div className="flex w-[52px] shrink-0 items-center justify-center rounded-xl bg-brand-100 py-3 text-gray-400"><CalendarDays className="h-5 w-5" /></div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-[15px] font-bold text-gray-900">{s.title}</p>
            {mode === 'upcoming' && s.show_date && <StatusPill tone="green">{countdownLabel(s.show_date, today)}</StatusPill>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            {meta && <span className="truncate">{meta}</span>}
            {s.format && <StatusPill tone="gray">{s.format}</StatusPill>}
            {s.booking_status && mode === 'upcoming' && <StatusPill tone={statusTone(s.booking_status)}>{s.booking_status}</StatusPill>}
            {s.tds_applicable && <StatusPill tone="amber">TDS</StatusPill>}
          </div>
        </div>
      </Link>

      <div className="flex shrink-0 items-center justify-between gap-4 pl-[66px] sm:flex-col sm:items-end sm:justify-center sm:gap-1 sm:pl-0">
        {mode === 'upcoming' ? (
          setlist ? (
            <Link href={`/setlists/${setlist.id}`} className="max-w-[12rem] truncate text-xs font-semibold text-gray-500 hover:text-brand-600">
              Setlist · {setlist.title}
            </Link>
          ) : (
            <Link href={`/setlists/new?showId=${s.id}`} className="text-xs font-bold text-amber-700 hover:underline">+ Add setlist</Link>
          )
        ) : (
          <>
            <span className="text-sm font-bold text-gray-900">{fmt(net)}</span>
            <StatusPill tone={isSplit ? 'green' : 'amber'}>{isSplit ? 'Split' : 'Unsplit'}</StatusPill>
          </>
        )}
      </div>
    </LongPressMenu>
  )
}

export function ShowSearchList({ shows, netByShow, setlistByShow, today, eventManagementById, insights }: ShowSearchListProps) {
  const [tab, setTab] = useState<Tab>('upcoming')
  const [query, setQuery] = useState('')
  const [format, setFormat] = useState('')
  const agencyOf = (s: Show) => (s.event_management_id ? eventManagementById[s.event_management_id]?.name : undefined)

  const q = query.trim().toLowerCase()
  const matches = (s: Show) =>
    (!format || s.format === format) &&
    (!q ||
      s.title.toLowerCase().includes(q) ||
      s.venue?.toLowerCase().includes(q) ||
      s.notes?.toLowerCase().includes(q) ||
      s.format?.toLowerCase().includes(q) ||
      agencyOf(s)?.toLowerCase().includes(q) ||
      setlistByShow[s.id]?.title.toLowerCase().includes(q))

  const upcoming = shows.filter(s => isUpcoming(s.show_date, today)).sort((a, b) => a.show_date!.localeCompare(b.show_date!))
  const played = shows.filter(s => !isUpcoming(s.show_date, today))
  const formats = [...new Set(shows.map(s => s.format).filter((f): f is string => !!f))].sort()

  // Searching surfaces matches from every group in one flat list, whichever tab you were on.
  const searching = q !== ''
  const flat = searching ? shows.filter(matches) : []
  const upcomingShown = upcoming.filter(matches)
  const playedShown = played.filter(matches)
  const firstUpcomingId = upcoming[0]?.id

  const row = (s: Show, mode: 'upcoming' | 'played') => (
    <ShowRow
      key={s.id} s={s} net={netByShow[s.id] ?? 0} setlist={setlistByShow[s.id]} today={today}
      agency={agencyOf(s)} mode={mode} strong={mode === 'upcoming' && s.id === firstUpcomingId}
    />
  )

  const insightsPreview = insights.formatBreakdown.length > 0 && (
    <aside className="hidden self-start rounded-2xl border border-brand-200 bg-white p-5 shadow-sm lg:block">
      <div className="mb-4 flex items-baseline justify-between">
        <SectionLabel>Insights</SectionLabel>
        <button type="button" onClick={() => setTab('insights')} className="text-xs font-bold text-brand-600 hover:underline">See all →</button>
      </div>
      <BarList rows={insights.formatBreakdown.slice(0, 4).map(r => ({ label: r.label, value: r.count }))} formatValue={n => String(n)} labelWidth="w-24" />
    </aside>
  )

  return (
    <div>
      <SegmentedTabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { value: 'played', label: 'Played', count: played.length },
          { value: 'insights', label: 'Insights' },
        ]}
      />

      {tab !== 'insights' && (
        <div className="mb-5 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-300" />
            <input
              type="text"
              placeholder="Search by title, venue, format, or notes…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>
          {formats.length > 0 && (
            <Select
              value={format}
              onChange={e => setFormat(e.target.value)}
              aria-label="Filter by format"
              className="rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            >
              <option value="">All formats</option>
              {formats.map(f => <option key={f} value={f}>{f}</option>)}
            </Select>
          )}
        </div>
      )}

      {tab === 'insights' ? (
        <ShowsDashboard {...insights} />
      ) : searching ? (
        flat.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">No shows matching &quot;{query}&quot;</p>
        ) : (
          <div className="space-y-2">{flat.map(s => row(s, isUpcoming(s.show_date, today) ? 'upcoming' : 'played'))}</div>
        )
      ) : tab === 'upcoming' ? (
        <div className="grid gap-6 lg:h-[calc(100vh-14rem)] lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="no-scrollbar space-y-6 lg:overflow-y-auto lg:pb-6">
            {upcomingShown.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-10 w-10" />}
                title="Nothing coming up"
                description="Add your next gig and its setlist, payment and split all live in one place."
                action={<Button asChild><Link href="/shows/new"><Plus className="h-4 w-4" /> Add a show</Link></Button>}
              />
            ) : (
              groupBy(upcomingShown, s => monthLabel(s.show_date!)).map(g => (
                <section key={g.key}>
                  <SectionLabel className="mb-2">{g.key}</SectionLabel>
                  <div className="space-y-2">{g.items.map(s => row(s, 'upcoming'))}</div>
                </section>
              ))
            )}
          </div>
          {insightsPreview}
        </div>
      ) : playedShown.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">No shows here yet</p>
      ) : (
        <div className="space-y-6">
          {groupBy(playedShown, s => (s.show_date ? s.show_date.slice(0, 4) : 'No date')).map(g => (
            <section key={g.key}>
              <SectionLabel className="mb-2">{g.key}</SectionLabel>
              <div className="space-y-2">{g.items.map(s => row(s, 'played'))}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
