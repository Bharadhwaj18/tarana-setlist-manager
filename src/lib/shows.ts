/**
 * Today's date as YYYY-MM-DD (server local time) — the same plain-date
 * format shows.show_date is stored in, so a straight string comparison is
 * enough to tell future from past without parsing.
 */
export function todayISO() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * A show is "upcoming" once it has a date and that date is after today —
 * hasn't happened yet, so there's nothing to split and it belongs in its
 * own Upcoming Shows section rather than the regular (already-played) list.
 */
export function isUpcoming(showDate: string | null, today: string) {
  return !!showDate && showDate > today
}
