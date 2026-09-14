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

/**
 * Known spelling variants for the same city in shows.venue, as entered
 * across different rows of the source booking sheet — folded to one
 * canonical display name for anything that groups shows by city (e.g. the
 * Shows dashboard's "Top cities" panel). Keyed lowercase; extend as new
 * variants turn up.
 */
const CITY_ALIASES: Record<string, string> = {
  bangalore: 'Bangalore',
  bengaluru: 'Bangalore',
  bngaluru: 'Bangalore', // typo seen in the source sheet
}

function titleCase(s: string) {
  return s.replace(/\S+/g, word => word[0].toUpperCase() + word.slice(1).toLowerCase())
}

/**
 * Canonical display name for a venue/city string — folds known spelling
 * variants (via CITY_ALIASES) and normalizes casing otherwise (so "udupi"
 * and "Udupi" land on the same key), so this alone is safe to group by.
 */
export function canonicalCity(venue: string) {
  const trimmed = venue.trim()
  return CITY_ALIASES[trimmed.toLowerCase()] ?? titleCase(trimmed)
}
