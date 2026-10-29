export type CalendarKind = 'show' | 'task' | 'off' | 'event' | 'else'

/** Diagonal hatching for "elsewhere" busy blocks, built from theme variables so it follows light/dark. */
const HATCH =
  'bg-[repeating-linear-gradient(45deg,var(--color-white),var(--color-white)_3px,var(--color-gray-100)_3px,var(--color-gray-100)_6px)]'

export const KIND_LABEL: Record<CalendarKind, string> = {
  show: 'Shows',
  task: 'Tasks',
  off: 'Unavailable',
  event: 'Events',
  else: 'Elsewhere',
}

/** Small pill inside a month cell, and the legend chips. */
export const KIND_PILL: Record<CalendarKind, string> = {
  show: 'bg-brand-100 text-brand-700',
  task: 'bg-sky-100 text-sky-800',
  off: 'bg-red-100 text-red-700',
  event: 'bg-amber-100 text-amber-800',
  else: `border border-dashed border-gray-300 text-gray-500 ${HATCH}`,
}

/** Coloured bar at the left of a day-detail row. */
export const KIND_BAR: Record<CalendarKind, string> = {
  show: 'bg-brand-400',
  task: 'bg-sky-600',
  off: 'bg-red-500',
  event: 'bg-amber-500',
  else: 'bg-gray-300',
}

export const HATCH_ROW = HATCH
