'use client'

import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'

export interface CrewPerson { id: string; name: string; crew: boolean }

/** Who runs the stall, and who else can sell from the kit. Merch crew are listed first. */
export function CrewPicker({ people, leadId, helperIds, onChange }: {
  people: CrewPerson[]
  leadId: string
  helperIds: string[]
  onChange: (next: { leadId: string; helperIds: string[] }) => void
}) {
  const label = (p: CrewPerson) => (p.crew ? `${p.name} (crew)` : p.name)
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="kit-lead">Running the stall</Label>
        <Select id="kit-lead" value={leadId} onChange={e => onChange({ leadId: e.target.value, helperIds: helperIds.filter(id => id !== e.target.value) })}>
          <option value="">Pick someone</option>
          {people.map(p => <option key={p.id} value={p.id}>{label(p)}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Helping (can sell too)</Label>
        <div className="flex flex-wrap gap-1.5">
          {people.filter(p => p.id !== leadId).map(p => {
            const on = helperIds.includes(p.id)
            return (
              <button key={p.id} type="button" aria-pressed={on}
                onClick={() => onChange({ leadId, helperIds: on ? helperIds.filter(x => x !== p.id) : [...helperIds, p.id] })}
                className={`rounded-full px-3 py-1 text-xs font-bold ${on ? 'bg-brand-400 text-white' : 'bg-brand-100 text-gray-700'}`}>
                {label(p)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
