import type { ReactNode } from 'react'

export const TODAY_COLUMNS = 12
const MIN_ROWS = 3

export interface Placed { id: string; span: number; node: ReactNode }

/**
 * Packs Today's widgets into rows of TODAY_COLUMNS, the same way KangaVault's dashboard does: a widget
 * that doesn't fit starts a new row. Whatever width is left at the end of a row is filled with a
 * filler card (or the row's last widget is stretched to reach the edge), so no row has a gap.
 */
export function packToday(widgets: Placed[], fillers: Placed[]): Placed[] {
  const rows: Placed[][] = []
  let current: Placed[] = []
  let used = 0
  for (const w of widgets) {
    if (used + w.span > TODAY_COLUMNS && current.length > 0) {
      rows.push(current)
      current = []
      used = 0
    }
    current.push(w)
    used += w.span
  }
  if (current.length > 0) rows.push(current)

  let next = 0
  for (const row of rows) {
    const remaining = TODAY_COLUMNS - row.reduce((sum, w) => sum + w.span, 0)
    if (remaining >= 3 && next < fillers.length) {
      row.push({ ...fillers[next], span: remaining })
      next++
    } else if (remaining > 0 && row.length > 0) {
      row[row.length - 1] = { ...row[row.length - 1], span: row[row.length - 1].span + remaining }
    }
  }

  // Too little on screen? Add whole rows of filler cards, three to a row.
  while (rows.length < MIN_ROWS && next < fillers.length) {
    const row: Placed[] = []
    for (let k = 0; k < 3 && next < fillers.length; k++) {
      row.push({ ...fillers[next], span: 4 })
      next++
    }
    rows.push(row)
  }

  return rows.flat()
}

// Literal class names, so Tailwind generates each one.
const SPAN_CLASS: Record<number, string> = {
  1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4', 5: 'lg:col-span-5', 6: 'lg:col-span-6',
  7: 'lg:col-span-7', 8: 'lg:col-span-8', 9: 'lg:col-span-9', 10: 'lg:col-span-10', 11: 'lg:col-span-11', 12: 'lg:col-span-12',
}

export function spanClass(span: number) {
  return SPAN_CLASS[span] ?? 'lg:col-span-12'
}
