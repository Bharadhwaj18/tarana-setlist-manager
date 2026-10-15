import Link from 'next/link'
import { ArrowRight, CalendarDays, ListMusic, Music2, Plus } from 'lucide-react'
import {
  getCachedShows, getCachedSetlistsByShow, getCachedSetlistSongCounts, getCachedTaskData,
  getCachedPendingPayments, getCachedAllProfiles, getCachedUser, getCachedCalendarEvents,
} from '@/lib/data'
import { todayISO } from '@/lib/shows'
import { daysUntil } from '@/lib/dates'
import { compareOpenTasks } from '@/lib/tasks'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { hiddenSectionsOf, type SectionKey } from '@/lib/workspace-sections'
import { infoCards, SectionTag } from '@/components/today/InfoWidgets'
import { QuickAccess } from '@/components/today/QuickAccess'
import { packToday, spanClass, type Placed } from '@/lib/today-layout'

const IST = 'Asia/Kolkata'

function shortDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(dateStr + 'T00:00:00Z'))
}

function rupees(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function headline(days: number) {
  if (days === 0) return "Showtime is today"
  if (days === 1) return "Showtime is tomorrow"
  if (days < 0) return "Show has passed"
  return `${days} days to showtime`
}

const eyebrow = 'text-xs font-semibold uppercase tracking-[0.12em] text-gray-500'
const card = 'flex h-full flex-col gap-3 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm'

export default async function TodayPage() {
  const [shows, setlistsByShow, songCounts, taskData, pending, profiles, { data: { user } }, workspaceCtx] = await Promise.all([
    getCachedShows(),
    getCachedSetlistsByShow(),
    getCachedSetlistSongCounts(),
    getCachedTaskData(),
    getCachedPendingPayments(),
    getCachedAllProfiles(),
    getCachedUser(),
    getWorkspaceContext(),
  ])

  // Only what this member can open is shown on Today.
  const levels = workspaceCtx?.current.sections
  const canSee = (key: SectionKey) => !levels || levels[key] !== 'none'
  const hidden: SectionKey[] = levels ? hiddenSectionsOf(levels) : []
  const calendarEvents = canSee('calendar') ? await getCachedCalendarEvents() : []

  // Light head-count queries for the quick-access hints (no rows are transferred).
  const ws = workspaceCtx?.current.workspace.id
  const supabase = await createClient()
  const [songsCount, setlistsCount, recordingsCount] = ws
    ? await Promise.all([
        canSee('songs') ? supabase.from('songs').select('id', { count: 'exact', head: true }).eq('workspace_id', ws) : null,
        canSee('setlists') ? supabase.from('setlists').select('id', { count: 'exact', head: true }).eq('workspace_id', ws) : null,
        canSee('recordings') ? supabase.from('recordings').select('id', { count: 'exact', head: true }).eq('workspace_id', ws) : null,
      ])
    : [null, null, null]

  const today = todayISO()
  const todayLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: IST }).format(new Date())
  const firstName = profiles.find(p => p.id === user?.id)?.display_name?.trim().split(/\s+/)[0] ?? ''

  const upcoming = shows
    .filter(s => s.show_date && s.show_date >= today)
    .sort((a, b) => a.show_date!.localeCompare(b.show_date!))
  const next = upcoming[0]
  // The next thing coming up: a show or a calendar event, whichever is sooner.
  const eventCandidates = calendarEvents
    .filter(e => e.end_date >= today)
    .map(e => ({ date: e.start_date < today ? today : e.start_date, title: e.title }))
  const nextEvent = [...eventCandidates].sort((a, b) => a.date.localeCompare(b.date))[0]
  const showDate = next?.show_date ?? null
  const nextIsEvent = !!nextEvent && (!showDate || nextEvent.date < showDate)
  const nextUpDate = nextIsEvent ? nextEvent.date : showDate
  const later = upcoming.slice(1, 4)
  const days = nextUpDate ? daysUntil(nextUpDate, today) : null
  const nextSetlist = next ? setlistsByShow.find(s => s.show_id === next.id) : undefined
  const nextSongCount = nextSetlist ? songCounts.filter(c => c.setlist_id === nextSetlist.id).length : 0

  const boardName = new Map(taskData.boards.map(b => [b.id, b.name]))
  const myTasks = taskData.tasks
    .filter(t => !!user && t.assignee_ids.includes(user.id) && t.progress !== 'completed' && boardName.has(t.board_id))
    .sort(compareOpenTasks)
  const openTaskCount = taskData.tasks.filter(t => t.progress !== 'completed').length
  const quickCounts = {
    upcomingShows: upcoming.length,
    setlists: setlistsCount?.count ?? null,
    songs: songsCount?.count ?? null,
    recordings: recordingsCount?.count ?? null,
    openTasks: openTaskCount,
    nextShowDate: nextUpDate,
  }
  const overdue = myTasks.filter(t => t.due_date && t.due_date < today).length

  const owed = pending.filter(p => p.to_member === user?.id).reduce((sum, p) => sum + p.amount, 0)
  const owe = pending.filter(p => p.from_member === user?.id).reduce((sum, p) => sum + p.amount, 0)

  const showShows = canSee('shows')
  const showTasks = canSee('tasks')
  const showFinance = canSee('finance')

  const stats: { label: string; value: string | number; tag: string }[] = [
    ...(showShows ? [{ label: 'Upcoming shows', value: upcoming.length, tag: 'Shows' }] : []),
    ...(showTasks ? [{ label: 'Open tasks', value: openTaskCount, tag: 'Tasks' }] : []),
    ...(canSee('songs') ? [{ label: 'Songs', value: songsCount?.count ?? '—', tag: 'Songs' }] : []),
    ...(canSee('setlists') ? [{ label: 'Setlists', value: setlistsCount?.count ?? '—', tag: 'Setlists' }] : []),
    ...(canSee('recordings') ? [{ label: 'Recordings', value: recordingsCount?.count ?? '—', tag: 'Recordings' }] : []),
  ]

  const quickActions = [
    showShows && { href: '/shows/new', label: 'New show', icon: CalendarDays },
    canSee('setlists') && { href: '/setlists/new', label: 'New setlist', icon: ListMusic },
    canSee('songs') && { href: '/songs/new', label: 'New song', icon: Music2 },
  ].filter(Boolean) as { href: string; label: string; icon: typeof CalendarDays }[]

  // Every widget a member can open, each with the width it takes on a 12-column row.
  const widgets: Placed[] = []

  if (nextEvent) {
    widgets.push({
      id: 'hero-event',
      span: 7,
      node: (
        <section className="flex h-full flex-col gap-4 rounded-2xl bg-hero p-6 text-hero-fg shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-sidebar-accent">Next on your calendar</span>
            <SectionTag label="Calendar" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">{nextEvent.title}</h2>
            <p className="mt-2 text-sm text-hero-muted">{shortDate(nextEvent.date)}</p>
          </div>
          <div className="mt-auto flex justify-end border-t border-hero-line pt-4">
            <Link href="/calendar" className="rounded-lg bg-sidebar-accent px-4 py-2 text-sm font-semibold text-sidebar-active-fg hover:opacity-90">Open calendar</Link>
          </div>
        </section>
      ),
    })
  } else if (showShows && next) {
    widgets.push({
      id: 'hero-show',
      span: 7,
      node: (
        <section className="flex h-full flex-col gap-4 rounded-2xl bg-hero p-6 text-hero-fg shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-sidebar-accent">Next event</span>
            <div className="flex items-center gap-2">
              <SectionTag label="Shows" />
              {next.booking_status && (
                <span className="rounded-full bg-sidebar-accent px-2.5 py-1 text-xs font-bold capitalize text-sidebar-active-fg">{next.booking_status}</span>
              )}
            </div>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">{next.title}</h2>
            <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-hero-muted">
              <span>{shortDate(next.show_date!)}</span>
              {next.venue && <span>{next.venue}</span>}
            </p>
          </div>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-hero-line pt-4">
            <div className="text-sm">
              {nextSetlist ? (
                <>
                  <p className="font-semibold">{nextSetlist.title}</p>
                  <p className="text-hero-muted">{nextSongCount} {nextSongCount === 1 ? 'song' : 'songs'}</p>
                </>
              ) : (
                <p className="text-hero-muted">No setlist linked yet</p>
              )}
            </div>
            <div className="flex gap-2">
              {nextSetlist ? (
                <Link href={`/setlists/${nextSetlist.id}`} className="rounded-lg bg-hero-hover px-4 py-2 text-sm font-semibold hover:opacity-90">Open setlist</Link>
              ) : canSee('setlists') ? (
                <Link href="/setlists/new" className="rounded-lg bg-hero-hover px-4 py-2 text-sm font-semibold hover:opacity-90">Create setlist</Link>
              ) : null}
              <Link href={`/shows/${next.id}`} className="rounded-lg bg-sidebar-accent px-4 py-2 text-sm font-semibold text-sidebar-active-fg hover:opacity-90">Show details</Link>
            </div>
          </div>
        </section>
      ),
    })
  } else if (showShows) {
    widgets.push({
      id: 'hero-empty',
      span: 7,
      node: (
        <section className={cn(card, 'items-start p-6')}>
          <CalendarDays className="h-8 w-8 text-brand-300" />
          <h2 className="text-xl font-bold text-gray-900">Nothing booked yet</h2>
          <p className="text-sm text-gray-500">Add your next gig and everything for it, from setlist to payment, lives in one place.</p>
          <Link href="/shows/new" className="inline-flex items-center gap-2 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500">
            <Plus className="h-4 w-4" /> Add a show
          </Link>
        </section>
      ),
    })
  }

  if (showTasks) {
    widgets.push({
      id: 'tasks',
      span: 5,
      node: (
        <section className={card}>
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-2"><h2 className={eyebrow}>Your tasks</h2><SectionTag label="Tasks" /></div>
            {overdue > 0 && <span className="text-xs font-bold text-red-600">{overdue} overdue</span>}
          </div>
          {myTasks.length === 0 ? (
            <p className="py-2 text-sm text-gray-500">Nothing assigned to you. Enjoy it.</p>
          ) : (
            <ul className="space-y-2.5">
              {myTasks.slice(0, 4).map(t => {
                const isOverdue = !!t.due_date && t.due_date < today
                return (
                  <li key={t.id}>
                    <Link href={`/tasks/${t.board_id}?task=${t.id}`} className="flex items-start justify-between gap-3 text-sm hover:text-brand-700">
                      <span className="min-w-0 text-gray-900">{t.title}</span>
                      <span className={cn('shrink-0 text-xs', isOverdue ? 'font-bold text-red-600' : 'text-gray-500')}>
                        {isOverdue ? 'Overdue' : t.due_date ? shortDate(t.due_date) : ''}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          <Link href="/tasks?view=mine" className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-semibold text-brand-600 hover:underline">
            All my tasks <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ),
    })
  }

  for (const st of stats) {
    widgets.push({
      id: `stat-${st.label}`,
      span: 3,
      node: (
        <div className="flex h-full flex-col justify-between gap-2 rounded-2xl border border-brand-200 bg-white px-4 py-3.5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-500">{st.label}</p>
            <SectionTag label={st.tag} />
          </div>
          <p className="font-display text-2xl font-bold text-gray-900">{st.value}</p>
        </div>
      ),
    })
  }

  widgets.push({
      id: 'jump-to',
      span: 12,
      node: (
        <>
          <div className="lg:hidden"><QuickAccess counts={quickCounts} variant="phone" hiddenSections={hidden} /></div>
          <div className="hidden lg:block"><QuickAccess counts={quickCounts} variant="desktop" hiddenSections={hidden} /></div>
        </>
      ),
    })

  if (showFinance) {
    widgets.push({
      id: 'owed',
      span: 4,
      node: (
        <Link href="/finance" className={cn(card, 'transition-colors hover:border-brand-300')}>
          <div className="flex items-center justify-between"><p className={eyebrow}>You are owed</p><SectionTag label="Finance" /></div>
          <p className="font-display text-3xl font-bold text-gray-900">{rupees(owed)}</p>
        </Link>
      ),
    })
    widgets.push({
      id: 'owe',
      span: 4,
      node: (
        <Link href="/finance" className={cn(card, 'transition-colors hover:border-brand-300')}>
          <div className="flex items-center justify-between"><p className={eyebrow}>You owe</p><SectionTag label="Finance" /></div>
          <p className="font-display text-3xl font-bold text-gray-900">{rupees(owe)}</p>
        </Link>
      ),
    })
  }

  if (showShows) {
    widgets.push({
      id: 'coming-up',
      span: 4,
      node: (
        <section className={card}>
          <div className="flex items-center justify-between"><h2 className={eyebrow}>Coming up</h2><SectionTag label="Shows" /></div>
          {later.length === 0 ? (
            <p className="text-sm text-gray-500">No more shows on the calendar.</p>
          ) : (
            <ul className="space-y-2">
              {later.map(s => (
                <li key={s.id}>
                  <Link href={`/shows/${s.id}`} className="flex items-baseline justify-between gap-3 text-sm hover:text-brand-700">
                    <span className="min-w-0 truncate text-gray-900">{s.title}</span>
                    <span className="shrink-0 text-xs text-gray-500">{shortDate(s.show_date!)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ),
    })
  }

  // App-wide cards fill whatever width is left on each row, so the screen is never half empty.
  const fillers: Placed[] = infoCards(today).map(c => ({ id: c.id, span: 4, node: c.node }))
  const placed = packToday(widgets, fillers)

  return (
    <div className="space-y-6">
      <header>
        <p className={eyebrow}>{todayLabel}</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900 sm:text-4xl">{firstName ? `Hi ${firstName}` : "Welcome back"}</h1>
        {days !== null && <p className="mt-1 text-base text-gray-600">{headline(days)}</p>}
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {placed.map(w => (
          <div key={w.id} className={cn('min-w-0', spanClass(w.span))}>
            {w.node}
          </div>
        ))}
      </div>

      {quickActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickActions.map(a => (
            <Link key={a.href} href={a.href} className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-brand-100">
              <a.icon className="h-4 w-4" /> {a.label}
            </Link>
          ))}
        </div>
      )}

    </div>
  )
}
