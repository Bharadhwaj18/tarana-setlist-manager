// The whole band is in India, so "today" always means the calendar date in
// IST — never the deploy server's own timezone. Vercel functions run in
// UTC, so between 00:00 and 05:29 IST the naive `new Date().getDate()`
// approach reads yesterday's date; explicitly formatting in this zone
// sidesteps that regardless of where the code executes.
export const IST_TIME_ZONE = 'Asia/Kolkata'

/**
 * Today's date as YYYY-MM-DD in IST — the same plain-date format
 * shows.show_date is stored in, so a straight string comparison is enough
 * to tell future from past without parsing.
 */
export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
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
