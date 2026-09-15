'use client'

import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { sendNotification, sendNotificationToAll } from '@/actions/notifications'
import { useToast } from '@/components/ui/Toaster'

interface Member { id: string; name: string }

interface Props {
  members: Member[]
}

const ALL = '__all__'

export function SendNotificationModal({ members }: Props) {
  const [open, setOpen] = useState(false)
  // Defaults to a specific person, not everyone — broadcasting should be a
  // deliberate choice, not what fires if someone submits without looking.
  const [recipientId, setRecipientId] = useState(members[0]?.id ?? ALL)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const canSubmit = recipientId !== '' && title.trim() !== ''

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)

    startTransition(async () => {
      const result = recipientId === ALL
        ? await sendNotificationToAll({ title: title.trim(), body: body.trim() || null })
        : await sendNotification({ recipientId, title: title.trim(), body: body.trim() || null })
      if (result.error) {
        setError(result.error)
        return
      }
      toast('Notification sent', 'success')
      setTitle('')
      setBody('')
      setOpen(false)
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Send className="h-4 w-4" /> New Notification
      </Button>
      <Modal open={open} onOpenChange={setOpen} title="Send a Notification" description="Goes straight to their inbox, and as a push if they've enabled it.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="recipient">To</Label>
            <select
              id="recipient"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              value={recipientId}
              onChange={e => setRecipientId(e.target.value)}
            >
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              <option value={ALL}>Everyone</option>
            </select>
          </div>
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" className="mt-1" placeholder="Practice moved to Saturday" value={title}
              onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="body">Message</Label>
            <Textarea id="body" rows={3} placeholder="Optional details..." className="mt-1" value={body}
              onChange={e => setBody(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isPending} disabled={!canSubmit}>Send</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
