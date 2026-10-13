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
  off: 'bg-gray-100 text-gray-600',
  event: 'bg-amber-100 text-amber-800',
  else: `border border-dashed border-gray-300 text-gray-500 ${HATCH}`,
}

/** Coloured bar at the left of a day-detail row. */
export const KIND_BAR: Record<CalendarKind, string> = {
  show: 'bg-brand-400',
  task: 'bg-sky-600',
  off: 'bg-gray-400',
  event: 'bg-amber-500',
  else: 'bg-gray-300',
}

/** Dot under the number in the compact phone month. */
export const KIND_DOT: Record<CalendarKind, string> = {
  show: 'bg-brand-400',
  task: 'bg-sky-600',
  off: 'bg-gray-400',
  event: 'bg-amber-500',
  else: 'border border-gray-400 bg-white',
}

/** Same dots when the day is selected (dark forest background). */
export const KIND_DOT_SELECTED: Record<CalendarKind, string> = {
  show: 'bg-sidebar-accent',
  task: 'bg-sky-300',
  off: 'bg-gray-300',
  event: 'bg-amber-400',
  else: 'border border-sidebar-accent bg-transparent',
}

export const HATCH_ROW = HATCH
