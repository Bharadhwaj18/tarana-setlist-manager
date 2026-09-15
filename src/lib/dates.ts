// Shared date helpers — this app stores dates as plain YYYY-MM-DD strings
// (see src/lib/shows.ts's todayISO()/isUpcoming()) and only reaches for a
// real Date object for display formatting or day-diff math, always via the
// `+ 'T00:00:00'` suffix to dodge UTC-shift off-by-one bugs. Originally
// lived in ShowSearchList.tsx; Notes/Tasks and the reminders cron need the
// same logic now, so it's shared from here instead of duplicated.

export function daysUntil(dateStr: string, today: string) {
  const ms = new Date(dateStr + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()
  return Math.round(ms / 86400000)
}

export function countdownLabel(dateStr: string, today: string) {
  const days = daysUntil(dateStr, today)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days < 0) return `${Math.abs(days)} days overdue`
  return `In ${days} days`
}

/** Adds `n` days to a YYYY-MM-DD string, returning another YYYY-MM-DD string. */
export function addDaysISO(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Adds `n` months to a YYYY-MM-DD string (for monthly recurrence), clamping to the last valid day of the target month. */
export function addMonthsISO(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const lastDayOfTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDayOfTargetMonth))
  return toISODate(d)
}

function toISODate(d: Date) {
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
