import { Label } from '@/components/ui/Label'
import { VISIBILITIES, VISIBILITY_HINTS, VISIBILITY_LABELS, type Visibility } from '@/lib/visibility'

interface Props {
  id: string
  value: Visibility
  onChange: (value: Visibility) => void
}

export function VisibilitySelect({ id, value, onChange }: Props) {
  return (
    <div>
      <Label htmlFor={id}>Visible to your other workspaces</Label>
      <select
        id={id}
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        value={value}
        onChange={e => onChange(e.target.value as Visibility)}
      >
        {VISIBILITIES.map(v => <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>)}
      </select>
      <p className="mt-1 text-xs text-gray-500">{VISIBILITY_HINTS[value]}</p>
    </div>
  )
}
