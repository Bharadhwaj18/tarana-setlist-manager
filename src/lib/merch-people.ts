/** People for a kit's crew pickers: Merch crew first (tagged), then everyone else, each group by name. */
export function crewPickerPeople(people: { id: string; name: string }[], crewIds: string[]): { id: string; name: string; crew: boolean }[] {
  const crew = new Set(crewIds)
  return people
    .map(p => ({ ...p, crew: crew.has(p.id) }))
    .sort((a, b) => Number(b.crew) - Number(a.crew) || a.name.localeCompare(b.name))
}
