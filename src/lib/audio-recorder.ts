'use client'

import { useCallback, useRef, useState } from 'react'

// Preference order matters: opus/webm is the smallest, most widely
// supported format on Chrome/Android/desktop, but Safari (iOS and macOS)
// doesn't support it at all — MediaRecorder there only ever produces
// mp4/aac. Trying each in order and taking the first the browser actually
// claims to support beats hardcoding one and hoping.
const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
]

// `isSupported` is injectable so this stays testable under vitest's node
// environment, which has no MediaRecorder at all — the default only runs
// in a real browser, where a caller doesn't pass one.
export function pickSupportedMimeType(
  isSupported: (type: string) => boolean = type =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
): string | null {
  for (const type of CANDIDATE_MIME_TYPES) {
    if (isSupported(type)) return type
  }
  return null
}

// Playback file extension only matters for a sensible filename/Storage
// path — the browser plays back by `mime_type`, not by extension.
export function extensionForMimeType(mimeType: string): string {
  return mimeType.includes('mp4') || mimeType.includes('aac') ? 'm4a' : 'webm'
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(s / 60)
  const seconds = s % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export type RecorderStatus = 'idle' | 'recording' | 'permission-denied' | 'unsupported'

export interface RecordedClip {
  blob: Blob
  mimeType: string
  durationSeconds: number
}

interface UseAudioRecorderResult {
  status: RecorderStatus
  elapsedSeconds: number
  start: () => Promise<void>
  stop: () => Promise<RecordedClip | null>
}

/**
 * Wraps getUserMedia + MediaRecorder for a simple record/stop flow. Doesn't
 * try to read precise duration off the encoded blob (unreliable across
 * browsers, especially for webm) — the elapsed-seconds timer this tracks
 * while recording becomes the stored duration instead.
 */
export function useAudioRecorder(): UseAudioRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const mimeTypeRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef(0)

  const start = useCallback(async () => {
    const mimeType = pickSupportedMimeType()
    if (!mimeType) {
      setStatus('unsupported')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setStatus('permission-denied')
      return
    }

    streamRef.current = stream
    mimeTypeRef.current = mimeType
    chunksRef.current = []

    const recorder = new MediaRecorder(stream, { mimeType })
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorderRef.current = recorder
    recorder.start()

    startedAtRef.current = Date.now()
    setElapsedSeconds(0)
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 250)

    setStatus('recording')
  }, [])

  const stop = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder) return null

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
    const mimeType = mimeTypeRef.current

    const blob = await new Promise<Blob>(resolve => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: mimeType }))
      recorder.stop()
    })

    streamRef.current?.getTracks().forEach(t => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
    recorderRef.current = null
    streamRef.current = null
    timerRef.current = null
    setStatus('idle')
    setElapsedSeconds(0)

    return { blob, mimeType, durationSeconds }
  }, [])

  return { status, elapsedSeconds, start, stop }
}
