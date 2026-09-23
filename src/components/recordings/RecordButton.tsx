'use client'

import { useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toaster'
import { createClient } from '@/lib/supabase/client'
import { createRecording } from '@/actions/recordings'
import { useAudioRecorder, extensionForMimeType, formatDuration } from '@/lib/audio-recorder'

const BUCKET = 'recordings'

export function RecordButton({ userId }: { userId: string }) {
  const { status, elapsedSeconds, start, stop } = useAudioRecorder()
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const handleStart = async () => {
    await start()
  }

  const handleStop = async () => {
    const clip = await stop()
    if (!clip) return

    setSaving(true)
    try {
      const supabase = createClient()
      const ext = extensionForMimeType(clip.mimeType)
      const filePath = `${userId}/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, clip.blob, { contentType: clip.mimeType })
      if (uploadError) {
        toast('Failed to upload recording', 'error')
        return
      }

      const title = `Untitled recording — ${new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
      const result = await createRecording({
        title,
        filePath,
        durationSeconds: clip.durationSeconds,
        mimeType: clip.mimeType,
      })
      if (result.error) {
        toast(result.error, 'error')
      } else {
        toast('Recording saved', 'success')
      }
    } finally {
      setSaving(false)
    }
  }

  if (status === 'unsupported') {
    return <p className="text-sm text-gray-400">Recording isn&apos;t supported in this browser.</p>
  }

  if (status === 'permission-denied') {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        Microphone access was denied. Allow it in your browser&apos;s site settings, then try again.
        <button onClick={handleStart} className="ml-2 font-medium underline underline-offset-2">Retry</button>
      </div>
    )
  }

  if (status === 'recording') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <span className="flex h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
        <span className="flex-1 text-sm font-semibold tabular-nums text-red-700">Recording… {formatDuration(elapsedSeconds)}</span>
        <Button variant="danger" size="sm" onClick={handleStop} loading={saving}>
          <Square className="h-3.5 w-3.5" /> Stop
        </Button>
      </div>
    )
  }

  return (
    <Button onClick={handleStart} loading={saving}>
      <Mic className="h-4 w-4" /> Record
    </Button>
  )
}
