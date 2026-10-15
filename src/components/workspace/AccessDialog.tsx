'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { setMemberSections } from '@/actions/workspace'
import { SECTIONS, type SectionKey, type SectionLevel, type SectionLevels } from '@/lib/workspace-sections'

interface Props {
  memberId: string
  memberName: string
  initial: SectionLevels
  open: boolean
  onOpenChange: (open: boolean) => void
}

const box = 'h-5 w-5 cursor-pointer accent-brand-400 disabled:cursor-not-allowed'

/** Two tick boxes per section: View (can open it) and Edit (can change things). Edit implies View. */
export function AccessDialog({ memberId, memberName, initial, open, onOpenChange }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [levels, setLevels] = useState<SectionLevels>(initial)
  const [isPending, startTransition] = useTransition()

  // Start from the saved access each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setLevels(initial)
  }

  const setLevel = (key: SectionKey, level: SectionLevel) => setLevels(prev => ({ ...prev, [key]: level }))
  const toggleView = (key: SectionKey, on: boolean) => setLevel(key, on ? 'view' : 'none')
  const toggleEdit = (key: SectionKey, on: boolean) => setLevel(key, on ? 'edit' : levels[key] === 'none' ? 'none' : 'view')
  const setAll = (level: SectionLevel) => setLevels(Object.fromEntries(SECTIONS.map(s => [s.key, level])) as SectionLevels)

  const save = () => {
    startTransition(async () => {
      const result = await setMemberSections(memberId, levels)
      if (result.error) { toast(result.error, 'error'); return }
      toast(`Saved access for ${memberName}`, 'success')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`What ${memberName} can access`} description="View lets them open a section. Edit lets them add and change things in it." className="max-w-md">
      <div className="mt-2 flex items-center justify-between gap-2 text-xs font-bold">
        <button type="button" onClick={() => setAll('edit')} className="text-brand-600 hover:underline">Allow everything</button>
        <button type="button" onClick={() => setAll('none')} className="text-gray-500 hover:underline">Hide everything</button>
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
                <input
                  type="checkbox"
                  aria-label={`${s.label}: can view`}
                  checked={level !== 'none'}
                  disabled={isPending}
                  onChange={e => toggleView(s.key, e.target.checked)}
                  className={box}
                />
              </span>
              <span className="flex justify-center">
                <input
                  type="checkbox"
                  aria-label={`${s.label}: can edit`}
                  checked={level === 'edit'}
                  disabled={isPending || level === 'none'}
                  onChange={e => toggleEdit(s.key, e.target.checked)}
                  className={box}
                />
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
        <Button onClick={save} loading={isPending}>Save access</Button>
      </div>
    </Modal>
  )
}
