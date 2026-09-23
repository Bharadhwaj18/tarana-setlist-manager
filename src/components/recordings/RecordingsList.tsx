'use client'

import { useRef, useState } from 'react'
import { Play, Pause, Pencil, Trash2, Tag, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toaster'
import { createClient } from '@/lib/supabase/client'
import { renameRecording, tagRecordingToSong, deleteRecording } from '@/actions/recordings'
import { formatDuration } from '@/lib/audio-recorder'
import type { RecordingWithSong } from '@/types'

const BUCKET = 'recordings'

interface Song { id: string; title: string }
interface Props {
  recordings: RecordingWithSong[]
  songs: Song[]
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function RecordingsList({ recordings, songs }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0) // 0-1, current playing row only
  const [editingId, setEditingId] = useState<string | null>(null)
  const [taggingId, setTaggingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const toast = useToast()

  const handleTogglePlay = async (recording: RecordingWithSong) => {
    const audio = audioRef.current
    if (!audio) return

    if (playingId === recording.id) {
      audio.pause()
      setPlayingId(null)
      return
    }

    setBusyId(recording.id)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(recording.file_path, 3600)
      if (error || !data) {
        toast('Failed to load recording', 'error')
        return
      }
      audio.src = data.signedUrl
      await audio.play()
      setPlayingId(recording.id)
      setProgress(0)
    } catch {
      toast('Failed to play recording', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleTimeUpdate = () => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    setProgress(audio.currentTime / audio.duration)
  }

  const startEditing = (recording: RecordingWithSong) => setEditingId(recording.id)

  const handleRenameSubmit = async (id: string, title: string) => {
    setEditingId(null)
    if (!title.trim()) return
    const result = await renameRecording(id, title)
    if (result.error) toast(result.error, 'error')
  }

  const handleTag = async (id: string, songId: string | null) => {
    setTaggingId(null)
    const result = await tagRecordingToSong(id, songId)
    if (result.error) toast(result.error, 'error')
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setBusyId(deletingId)
    const result = await deleteRecording(deletingId)
    setBusyId(null)
    setDeletingId(null)
    if (result.error) toast(result.error, 'error')
    else toast('Recording deleted', 'success')
  }

  if (recordings.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
        <p className="text-sm font-medium text-gray-500">No recordings yet</p>
        <p className="mt-1 text-xs text-gray-400">Hit Record above to capture your first idea.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Single shared player — only one recording plays at a time, same as Apple's Voice Memos. */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => { setPlayingId(null); setProgress(0) }}
        className="hidden"
      />

      {recordings.map(r => {
        const isPlaying = playingId === r.id
        const isEditing = editingId === r.id
        const isTagging = taggingId === r.id
        const isBusy = busyId === r.id

        return (
          <div key={r.id} className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-brand-100">
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleTogglePlay(r)}
                disabled={isBusy}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-400 text-white hover:bg-brand-500 disabled:opacity-60"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
              </button>

              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <input
                    autoFocus
                    defaultValue={r.title}
                    onBlur={e => handleRenameSubmit(r.id, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="w-full rounded border border-brand-300 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                ) : (
                  <button onClick={() => startEditing(r)} className="group flex items-center gap-1.5 truncate text-left">
                    <span className="truncate text-sm font-medium text-gray-900">{r.title}</span>
                    <Pencil className="h-3 w-3 shrink-0 text-gray-300 group-hover:text-gray-500" />
                  </button>
                )}
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  <span className="tabular-nums">{formatDuration(r.duration_seconds)}</span>
                  <span>·</span>
                  <span>{dateLabel(r.created_at)}</span>
                  {r.song ? (
                    <button
                      onClick={() => setTaggingId(r.id)}
                      className="flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700 hover:bg-brand-200"
                    >
                      <Tag className="h-3 w-3" /> {r.song.title}
                    </button>
                  ) : (
                    <button onClick={() => setTaggingId(r.id)} className="flex items-center gap-1 text-brand-500 hover:text-brand-700">
                      <Tag className="h-3 w-3" /> Tag a song
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => setDeletingId(r.id)}
                className="shrink-0 rounded-md p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {isPlaying && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-brand-100">
                <div className="h-full rounded-full bg-brand-400 transition-[width]" style={{ width: `${progress * 100}%` }} />
              </div>
            )}

            {isTagging && (
              <div className="mt-2 flex items-center gap-2 rounded-md bg-brand-50 px-2.5 py-2">
                <select
                  autoFocus
                  defaultValue={r.song_id ?? ''}
                  onChange={e => handleTag(r.id, e.target.value || null)}
                  className="flex-1 rounded border border-brand-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                >
                  <option value="">No song</option>
                  {songs.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
                <button onClick={() => setTaggingId(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )
      })}

      <Modal
        open={!!deletingId}
        onOpenChange={o => { if (!o) setDeletingId(null) }}
        title="Delete recording?"
        description="This permanently deletes the audio — it can't be recovered."
      >
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeletingId(null)}>Cancel</Button>
          <Button variant="danger" loading={!!busyId} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
