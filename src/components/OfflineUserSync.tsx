'use client'

import { useEffect } from 'react'
import { saveUserOffline } from '@/lib/offline'

interface OfflineUserSyncProps {
  email: string
  displayName: string
}

export function OfflineUserSync({ email, displayName }: OfflineUserSyncProps) {
  useEffect(() => {
    saveUserOffline({ email, displayName })
  }, [email, displayName])
  return null
}
