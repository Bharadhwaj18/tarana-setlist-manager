export const VISIBILITIES = ['hidden', 'busy', 'details'] as const
export type Visibility = (typeof VISIBILITIES)[number]

export const DEFAULT_VISIBILITY: Visibility = 'busy'

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  hidden: 'Hidden',
  busy: 'Busy only',
  details: 'Full details',
}

export const VISIBILITY_HINTS: Record<Visibility, string> = {
  hidden: 'Not shown in your other workspaces.',
  busy: 'Others in your other workspaces see you as busy, nothing else.',
  details: 'Others in your other workspaces see the title and details.',
}

export function asVisibility(value: string | null | undefined): Visibility {
  return (VISIBILITIES as readonly string[]).includes(value ?? '') ? (value as Visibility) : DEFAULT_VISIBILITY
}
