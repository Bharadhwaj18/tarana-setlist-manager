'use client'

import { useSwitchWorkspace } from '@/components/layout/useSwitchWorkspace'
import { cn } from '@/lib/utils'

interface Props {
  id: string
  currentId: string
  personal: boolean
}

/** Open (switch, then Today) and Settings (switch, then the workspace settings page) for one workspace card. */
export function WorkspaceCardActions({ id, currentId, personal }: Props) {
  const { pending, switchTo } = useSwitchWorkspace()
  return (
    <div className={cn('flex gap-2', pending && 'opacity-70')}>
      <button
        type="button"
        disabled={pending}
        onClick={() => switchTo(id, currentId, '/')}
        className="rounded-xl bg-brand-400 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-500 disabled:opacity-60"
      >
        Open
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => switchTo(id, currentId, '/workspace')}
        className="rounded-xl border border-brand-200 bg-white px-4 py-2 text-sm font-bold text-gray-800 transition-colors hover:bg-brand-50 disabled:opacity-60"
      >
        {personal ? 'About' : 'Settings'}
      </button>
    </div>
  )
}
