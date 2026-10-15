'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { setMemberSections } from '@/actions/workspace'
import type { SectionLevels } from '@/lib/workspace-sections'
import { SectionAccessGrid } from './SectionAccessGrid'

interface Props {
  memberId: string
  memberName: string
  initial: SectionLevels
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Edit one member's access, section by section. */
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
      <div className="mt-2">
        <SectionAccessGrid levels={levels} onChange={setLevels} disabled={isPending} />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
        <Button onClick={save} loading={isPending}>Save access</Button>
      </div>
    </Modal>
  )
}
