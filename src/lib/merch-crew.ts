/**
 * Merch crew (not owners or admins) only belong in Merch: they're left out of the band's member lists, pickers and
 * band-wide notifications everywhere else.
 */
export const isMerchCrewRow = (m: { role: string; permissions: unknown }) =>
  m.role !== 'owner' && m.role !== 'admin' && !!m.permissions && typeof m.permissions === 'object' && !Array.isArray(m.permissions) &&
  (m.permissions as Record<string, unknown>).merch_crew === true
