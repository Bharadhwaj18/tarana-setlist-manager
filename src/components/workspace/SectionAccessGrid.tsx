'use client'

import { SECTIONS, type SectionKey, type SectionLevel, type SectionLevels } from '@/lib/workspace-sections'

const box = 'h-5 w-5 cursor-pointer accent-brand-400 disabled:cursor-not-allowed'

export const allSections = (level: SectionLevel) => Object.fromEntries(SECTIONS.map(s => [s.key, level])) as SectionLevels

/** Two tick boxes per section: View (can open it) and Edit (can change things). Edit implies View. */
export function SectionAccessGrid({ levels, onChange, disabled }: { levels: SectionLevels; onChange: (next: SectionLevels) => void; disabled?: boolean }) {
  const setLevel = (key: SectionKey, level: SectionLevel) => onChange({ ...levels, [key]: level })
  const toggleView = (key: SectionKey, on: boolean) => setLevel(key, on ? 'view' : 'none')
  const toggleEdit = (key: SectionKey, on: boolean) => setLevel(key, on ? 'edit' : levels[key] === 'none' ? 'none' : 'view')

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs font-bold">
        <button type="button" disabled={disabled} onClick={() => onChange(allSections('edit'))} className="text-brand-600 hover:underline">Allow everything</button>
        <button type="button" disabled={disabled} onClick={() => onChange(allSections('view'))} className="text-gray-600 hover:underline">View only, everywhere</button>
        <button type="button" disabled={disabled} onClick={() => onChange(allSections('none'))} className="text-gray-500 hover:underline">Hide everything</button>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-brand-200">
        <div className="grid grid-cols-[1fr_4.5rem_4.5rem] bg-brand-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-500">
          <span>Section</span>
          <span className="text-center">View</span>
          <span className="text-center">Edit</span>
        </div>
        {SECTIONS.map(s => {
          const level = levels[s.key]
          return (
            <div key={s.key} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center border-t border-brand-100 px-4 py-2.5">
              <span className={level === 'none' ? 'text-sm font-semibold text-gray-400' : 'text-sm font-semibold text-gray-900'}>{s.label}</span>
              <span className="flex justify-center">
                <input type="checkbox" aria-label={`${s.label}: can view`} checked={level !== 'none'} disabled={disabled}
                  onChange={e => toggleView(s.key, e.target.checked)} className={box} />
              </span>
              <span className="flex justify-center">
                <input type="checkbox" aria-label={`${s.label}: can edit`} checked={level === 'edit'} disabled={disabled || level === 'none'}
                  onChange={e => toggleEdit(s.key, e.target.checked)} className={box} />
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** "Everything", "View only" or e.g. "No Finance, Notes view only" — a short summary for lists. */
export function accessSummary(levels: SectionLevels): string {
  const hidden = SECTIONS.filter(s => levels[s.key] === 'none').map(s => s.label)
  const viewOnly = SECTIONS.filter(s => levels[s.key] === 'view').map(s => s.label)
  if (hidden.length === 0 && viewOnly.length === 0) return 'Everything'
  if (hidden.length === SECTIONS.length) return 'Nothing yet'
  if (viewOnly.length === SECTIONS.length) return 'View only'
  return [hidden.length > 0 && `No ${hidden.join(', ')}`, viewOnly.length > 0 && `${viewOnly.join(', ')} view only`].filter(Boolean).join(' · ')
}
