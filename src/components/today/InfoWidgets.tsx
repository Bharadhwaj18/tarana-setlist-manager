import { Megaphone, Newspaper, Quote, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

/** A small label that says which section a widget belongs to (or that it's app-wide info). */
export function SectionTag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-gray-600">{label}</span>
  )
}

const TIPS = [
  'Press and hold any setlist, show or song to open its actions.',
  'Swipe the phone calendar left or right to change month.',
  'Tap the workspace name at the top to switch between workspaces.',
  'Pin a note to keep it at the top of Notes.',
  'Tasks can be sorted by deadline, so the most urgent ones come first.',
]

const REVIEWS = [
  { quote: 'Finally one place for setlists, shows and who owes what.', by: 'A band manager' },
  { quote: 'The stage view alone saved us at our last festival set.', by: 'A solo artist' },
]

const UPDATES = [
  'Tasks: list view with sorting and filters',
  'Notes: private by default, linked to shows and songs',
  'Calendar: add events from a pop-up on any day',
]

export interface InfoCard { id: string; node: ReactNode }

/**
 * App-wide cards used to fill the gaps on Today. They're shown after the member's own widgets, so
 * the screen is never half empty. News and reviews are sample copy until real feeds exist.
 */
export function infoCards(today: string): InfoCard[] {
  const dayIndex = Math.floor(Date.parse(today + 'T00:00:00Z') / 86400000)
  const review = REVIEWS[dayIndex % REVIEWS.length]
  const frame = (tag: string, title: string, icon: typeof Sparkles, body: ReactNode) => (
    <section className="flex h-full flex-col gap-3 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        {(() => { const Icon = icon; return <Icon className="h-5 w-5 text-brand-600" /> })()}
        <SectionTag label={tag} />
      </div>
      <h3 className="font-display text-lg font-bold text-gray-900">{title}</h3>
      {body}
    </section>
  )
  return [
    { id: 'tip', node: frame('Tip', 'Tip of the day', Sparkles, <p className="text-sm text-gray-700">{TIPS[dayIndex % TIPS.length]}</p>) },
    {
      id: 'updates',
      node: frame('ArtistOps', "What's new", Megaphone, (
        <ul className="space-y-1.5 text-sm text-gray-700">
          {UPDATES.map(u => <li key={u} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-500" />{u}</li>)}
        </ul>
      )),
    },
    {
      id: 'review',
      node: frame('Sample review', 'From people using it', Quote, (
        <figure>
          <blockquote className="text-sm text-gray-700">&ldquo;{review.quote}&rdquo;</blockquote>
          <figcaption className="mt-2 text-xs text-gray-500">{review.by}</figcaption>
        </figure>
      )),
    },
    {
      id: 'news',
      node: frame('Sample news', 'Artist news', Newspaper, <p className="text-sm text-gray-700">Festival line-ups and studio news from artists you follow will appear here.</p>),
    },
    {
      id: 'start',
      node: frame('ArtistOps', 'Get started', Sparkles, <p className="text-sm text-gray-700">Add your next show, then build its setlist. Everything for the gig stays in one place.</p>),
    },
    {
      id: 'tip2',
      node: frame('Tip', 'Quick tip', Sparkles, <p className="text-sm text-gray-700">{TIPS[(dayIndex + 2) % TIPS.length]}</p>),
    },
  ]
}
