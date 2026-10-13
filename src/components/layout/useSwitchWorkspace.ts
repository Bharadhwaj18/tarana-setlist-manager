'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { switchWorkspace } from '@/actions/workspace'

/** Switches the current workspace (cookie + cache revalidation live in the server action), then refreshes or navigates. */
export function useSwitchWorkspace(onDone?: () => void) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const switchTo = (id: string, currentId: string, thenGoTo?: string) => {
    if (id === currentId) {
      if (thenGoTo) router.push(thenGoTo)
      onDone?.()
      return
    }
    startTransition(async () => {
      const res = await switchWorkspace(id)
      if (res.error) return
      if (thenGoTo) router.push(thenGoTo)
      else router.refresh()
      onDone?.()
    })
  }

  return { pending, switchTo }
}
