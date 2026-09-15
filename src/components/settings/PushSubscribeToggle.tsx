'use client'

import { useEffect, useState, useTransition } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { subscribeToPush, unsubscribeFromPush } from '@/actions/notifications'
import { urlBase64ToUint8Array } from '@/lib/push-client'

type Status = 'checking' | 'unsupported' | 'subscribed' | 'unsubscribed' | 'denied'

export function PushSubscribeToggle() {
  const [status, setStatus] = useState<Status>('checking')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  // Syncing with the browser's real push-subscription state on mount is
  // exactly what an effect is for — this isn't derivable from props/state,
  // it's an external system (service worker + Push API) being asked.
  useEffect(() => {
    async function check() {
      if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        setStatus('denied')
        return
      }
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      setStatus(existing ? 'subscribed' : 'unsubscribed')
    }
    check()
  }, [])

  const enable = () => {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setStatus(permission === 'denied' ? 'denied' : 'unsubscribed')
          return
        }
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!publicKey) {
          toast('Push isn’t fully set up yet — missing VAPID key', 'error')
          return
        }
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          // @types/node's Uint8Array<ArrayBufferLike> and lib.dom's
          // BufferSource (which wants ArrayBuffer specifically) don't quite
          // line up — this is a known types mismatch, the value itself is fine.
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        })
        const json = subscription.toJSON()
        const result = await subscribeToPush({
          endpoint: subscription.endpoint,
          keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
        })
        if (result.error) {
          toast(result.error, 'error')
          return
        }
        setStatus('subscribed')
        toast('Notifications enabled on this device', 'success')
      } catch {
        toast('Couldn’t enable notifications on this device', 'error')
      }
    })
  }

  const disable = () => {
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await unsubscribeFromPush(subscription.endpoint)
          await subscription.unsubscribe()
        }
        setStatus('unsubscribed')
        toast('Notifications turned off on this device', 'success')
      } catch {
        toast('Couldn’t turn off notifications on this device', 'error')
      }
    })
  }

  if (status === 'checking') return <p className="text-sm text-gray-400">Checking…</p>

  if (status === 'unsupported') {
    return <p className="text-sm text-gray-500">Push notifications aren&apos;t supported in this browser. On iPhone, add this app to your Home Screen first (Share → Add to Home Screen), then try again from there.</p>
  }

  if (status === 'denied') {
    return <p className="text-sm text-amber-600">Notifications are blocked for this site in your browser settings — enable them there, then reload this page.</p>
  }

  if (status === 'subscribed') {
    return (
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-green-700"><Bell className="h-4 w-4" /> Enabled on this device</span>
        <Button variant="secondary" size="sm" loading={isPending} onClick={disable}>
          <BellOff className="h-4 w-4" /> Turn off
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-gray-500"><BellOff className="h-4 w-4" /> Not enabled on this device</span>
      <Button size="sm" loading={isPending} onClick={enable}>
        <Bell className="h-4 w-4" /> Enable
      </Button>
    </div>
  )
}
