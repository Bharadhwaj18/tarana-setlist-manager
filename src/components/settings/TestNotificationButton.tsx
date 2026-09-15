'use client'

import { useTransition } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { sendNotification } from '@/actions/notifications'

interface Props {
  userId: string
}

export function TestNotificationButton({ userId }: Props) {
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const send = () => {
    startTransition(async () => {
      const result = await sendNotification({
        recipientId: userId,
        title: 'Test notification',
        body: 'If you see this, push notifications are working 🎉',
      })
      if (result.error) {
        toast(result.error, 'error')
        return
      }
      toast('Sent — check your inbox and any device you’ve enabled push on', 'success')
    })
  }

  return (
    <Button variant="secondary" size="sm" loading={isPending} onClick={send}>
      <Send className="h-4 w-4" /> Send test notification to myself
    </Button>
  )
}
