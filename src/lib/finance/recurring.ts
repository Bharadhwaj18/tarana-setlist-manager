export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly'

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
}

const MAX_OCCURRENCES = 120

function parts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/**
 * Every date a rule falls on, from its start up to and including `until` (and its own end date, if
 * set). A monthly rule that starts on the 31st lands on the last day of shorter months. Capped, so a
 * rule with a start date far in the past can't create an unbounded number of entries at once.
 */
export function occurrences(rule: { frequency: RecurringFrequency; start_date: string; end_date?: string | null }, until: string): string[] {
  const last = rule.end_date && rule.end_date < until ? rule.end_date : until
  if (rule.start_date > last) return []
  const start = parts(rule.start_date)
  const out: string[] = []

  for (let i = 0; out.length < MAX_OCCURRENCES; i++) {
    let date: string
    if (rule.frequency === 'weekly') {
      const t = Date.UTC(start.y, start.m - 1, start.d) + i * 7 * 86400000
      date = new Date(t).toISOString().slice(0, 10)
    } else if (rule.frequency === 'monthly') {
      const monthIndex = start.m - 1 + i
      const y = start.y + Math.floor(monthIndex / 12)
      const m = (monthIndex % 12) + 1
      date = iso(y, m, Math.min(start.d, daysInMonth(y, m)))
    } else {
      const y = start.y + i
      date = iso(y, start.m, Math.min(start.d, daysInMonth(y, start.m)))
    }
    if (date > last) break
    out.push(date)
  }
  return out
}

/** The next date a rule will add an entry, after `today`, or null if it has ended. */
export function nextOccurrence(rule: { frequency: RecurringFrequency; start_date: string; end_date?: string | null }, today: string): string | null {
  const horizon = parts(today)
  const far = iso(horizon.y + 2, horizon.m, Math.min(horizon.d, 28))
  return occurrences(rule, far).find(d => d > today) ?? null
}
