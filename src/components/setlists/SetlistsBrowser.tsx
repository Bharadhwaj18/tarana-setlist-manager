'use client'

import { useMemo, useState } from 'react'
import { deleteSetlist } from '@/actions/setlists'
import { LongPressMenu, type MenuItem } from '@/components/ui/LongPressMenu'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, ListMusic, Pencil, Play, Search, Trash2 } from 'lucide-react'
import { Chip } from '@/components/ui/Chip'
import { DateTile } from '@/components/ui/DateTile'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { StatusPill } from '@/components/ui/StatusPill'
import { cn } from '@/lib/utils'
import type { Setlist } from '@/types'

export interface PreviewSong {
  id: string
  title: string
  artist: string | null
  key: string | null
}

interface Props {
  setlists: Setlist[]
  countMap: Record<string, number>
  /** First few songs of each setlist, in order. */
  previews: Record<string, PreviewSong[]>
  today: string
}

type Filter = 'all' | 'upcoming' | 'past'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
]

const AVG_SONG_MINUTES = 4.5

function estimateMinutes(songCount: number) {
  return Math.round(songCount * AVG_SONG_MINUTES)
}

function monthLabel(dateStr: string) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(dateStr + 'T00:00:00Z'))
}

function longDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(dateStr + 'T00:00:00Z'))
}

const stageHref = (setlistId: string, first?: PreviewSong) => (first ? `/songs/${first.id}?from=/setlists/${setlistId}` : `/setlists/${setlistId}`)

export function SetlistsBrowser({ setlists, countMap, previews, today }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const upcomingAll = useMemo(
    () => setlists.filter(s => s.show_date && s.show_date >= today).sort((a, b) => a.show_date!.localeCompare(b.show_date!)),
    [setlists, today]
  )
  const nextUp = upcomingAll[0]

  const [selectedId, setSelectedId] = useState<string | null>(nextUp?.id ?? setlists[0]?.id ?? null)

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = (s: Setlist) => !q || s.title.toLowerCase().includes(q) || (s.venue ?? '').toLowerCase().includes(q)
    const isUpcoming = (s: Setlist) => !!s.show_date && s.show_date >= today

    const upcoming = filter === 'past' ? [] : upcomingAll.filter(matches)
    const past = filter === 'upcoming' ? [] : setlists.filter(s => !isUpcoming(s) && matches(s))

    const out: { label: string; items: Setlist[] }[] = []
    if (upcoming.length) out.push({ label: 'Upcoming', items: upcoming })

    const byMonth = new Map<string, Setlist[]>()
    const undated: Setlist[] = []
    for (const s of past) {
      if (!s.show_date) { undated.push(s); continue }
      const key = s.show_date.slice(0, 7)
      byMonth.set(key, [...(byMonth.get(key) ?? []), s])
    }
    for (const key of [...byMonth.keys()].sort().reverse()) {
      const items = [...byMonth.get(key)!].sort((a, b) => b.show_date!.localeCompare(a.show_date!))
      out.push({ label: monthLabel(items[0].show_date!), items })
    }
    if (undated.length) out.push({ label: 'No date', items: undated })
    return out
  }, [setlists, upcomingAll, filter, query, today])

  const selected = setlists.find(s => s.id === selectedId) ?? groups[0]?.items[0] ?? null
  const selectedSongs = selected ? previews[selected.id] ?? [] : []
  const selectedCount = selected ? countMap[selected.id] ?? 0 : 0

  const pick = (e: React.MouseEvent, id: string) => {
    // On desktop a click previews; on a phone (no preview panel) it just follows the link.
    if (window.matchMedia('(min-width: 1024px)').matches) {
      e.preventDefault()
      setSelectedId(id)
    }
  }

  return (
    <div>
      {nextUp && (
        <div className="mb-5 flex flex-col gap-1.5 rounded-2xl bg-hero p-5 text-hero-fg lg:hidden">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-sidebar-accent">Next up · {longDate(nextUp.show_date!)}</span>
          <div className="font-display text-2xl font-bold">{nextUp.title}</div>
          <div className="text-sm text-hero-muted">{countMap[nextUp.id] ?? 0} songs · about {estimateMinutes(countMap[nextUp.id] ?? 0)} min</div>
          <div className="mt-2 flex gap-2">
            <Link href={stageHref(nextUp.id, previews[nextUp.id]?.[0])} className="flex-1 rounded-xl bg-sidebar-accent py-2.5 text-center text-sm font-extrabold text-sidebar-active-fg">Stage mode</Link>
            <Link href={`/setlists/${nextUp.id}`} className="flex-1 rounded-xl bg-hero-hover py-2.5 text-center text-sm font-bold">Open</Link>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:h-[calc(100vh-12.5rem)] lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="no-scrollbar flex min-w-0 flex-col gap-3 lg:overflow-y-auto lg:pb-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-300" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search setlists…"
              aria-label="Search setlists"
              className="w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>
          <div className="flex gap-1.5">
            {FILTERS.map(f => <Chip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</Chip>)}
          </div>

          {groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">{query ? `No setlists matching "${query}"` : 'Nothing here'}</p>
          ) : (
            groups.map(group => (
              <div key={group.label} className="flex flex-col gap-2">
                <SectionLabel className="mt-2">{group.label}</SectionLabel>
                {group.items.map(s => {
                  const count = countMap[s.id] ?? 0
                  const active = s.id === selected?.id
                  const menu: MenuItem[] = [
                    { label: 'Open', href: `/setlists/${s.id}`, icon: ListMusic },
                    { label: 'Stage mode', href: stageHref(s.id, previews[s.id]?.[0]), icon: Play },
                    { label: 'Edit', href: `/setlists/${s.id}/edit`, icon: Pencil },
                    { label: 'Delete', icon: Trash2, danger: true, onSelect: () => { if (window.confirm(`Delete "${s.title}"? This can’t be undone.`)) void deleteSetlist(s.id).then(r => { if (r.error) window.alert(r.error); else router.refresh() }) } },
                  ]
                  return (
                    <LongPressMenu key={s.id} title={s.title} items={menu}>
                    <Link
                      href={`/setlists/${s.id}`}
                      onClick={e => pick(e, s.id)}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl border bg-white p-3 transition-colors',
                        active ? 'border-brand-400 lg:ring-1 lg:ring-brand-400' : 'border-brand-200 hover:border-brand-300'
                      )}
                    >
                      {s.show_date ? <DateTile date={s.show_date} size="sm" tone={active ? 'strong' : 'soft'} /> : <div className="w-10 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-gray-900">{s.title}</p>
                        <p className="truncate text-xs text-gray-500">
                          {count} {count === 1 ? 'song' : 'songs'}{s.venue ? ` · ${s.venue}` : ''}
                        </p>
                      </div>
                      <span className="text-xl text-gray-400 lg:hidden">›</span>
                    </Link>
                    </LongPressMenu>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <aside className="no-scrollbar hidden min-w-0 lg:block lg:overflow-y-auto lg:pb-6">
          {selected ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-brand-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-600">
                    {selected.show_date ? longDate(selected.show_date) : 'No date'}{selected.venue ? ` · ${selected.venue}` : ''}
                  </p>
                  <h2 className="mt-1 break-words font-display text-2xl font-bold text-gray-900">{selected.title}</h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {selectedCount} {selectedCount === 1 ? 'song' : 'songs'} · about {estimateMinutes(selectedCount)} min
                    {selected.show_id && <> · <span className="font-semibold text-brand-600">linked to a show</span></>}
                  </p>
                </div>
                <Link
                  href={stageHref(selected.id, selectedSongs[0])}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-400 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-500"
                >
                  <Play className="h-4 w-4" /> Stage mode
                </Link>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href={`/setlists/${selected.id}/edit`} className="rounded-lg bg-brand-100 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-brand-200">Edit</Link>
                <Link href={`/setlists/${selected.id}`} className="rounded-lg bg-brand-100 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-brand-200">Export PDF &amp; offline</Link>
              </div>

              <div className="h-px bg-brand-200" />

              {selectedSongs.length === 0 ? (
                <p className="py-4 text-sm text-gray-500">No songs added yet.</p>
              ) : (
                <ol>
                  {selectedSongs.map((song, i) => (
                    <li key={`${song.id}-${i}`} className="flex items-center gap-3 border-b border-brand-100 py-2.5 last:border-0">
                      <span className="w-5 text-sm font-bold text-gray-400">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900">{song.title}</p>
                        {song.artist && <p className="truncate text-xs text-gray-500">{song.artist}</p>}
                      </div>
                      {song.key && <StatusPill tone="green" className="rounded-md px-2 text-xs">{song.key}</StatusPill>}
                    </li>
                  ))}
                </ol>
              )}

              <Link href={`/setlists/${selected.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-brand-600 hover:underline">
                {selectedCount > selectedSongs.length ? `+ ${selectedCount - selectedSongs.length} more · ` : ''}Open full setlist <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-gray-400">Pick a setlist to preview it.</p>
          )}
        </aside>
      </div>
    </div>
  )
}
