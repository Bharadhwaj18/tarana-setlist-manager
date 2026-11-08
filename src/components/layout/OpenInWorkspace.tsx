'use client'

import type { ReactNode } from 'react'
import { useSwitchWorkspace } from '@/components/layout/useSwitchWorkspace'

/** A row from another workspace: tapping it switches to that workspace, then opens the item there. */
export function OpenInWorkspace({ workspaceId, currentId, href, className, children }: { workspaceId: string; currentId: string; href: string; className?: string; children: ReactNode }) {
  const { pending, switchTo } = useSwitchWorkspace()
  return (
    <button type="button" disabled={pending} onClick={() => switchTo(workspaceId, currentId, href)} className={className}>
      {children}
    </button>
  )
}
