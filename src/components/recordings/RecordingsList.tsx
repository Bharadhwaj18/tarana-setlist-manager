'use client'

import { useRef, useState } from 'react'
import { Play, Pause, Pencil, Trash2, Tag, X, Search, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toaster'
import { createClient } from '@/lib/supabase/client'
import { renameRecording, tagRecordingToSong, deleteRecording } from '@/actions/recordings'
import { formatDuration } from '@/lib/audio-recorder'
import { similarity, FUZZY_THRESHOLD } from '@/lib/fuzzy'
import { cn } from '@/lib/utils'
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

// Same fuzzy-search-then-list pattern as AddSongToSetlistModal/
// BulkImportModal's resolve step — a plain <select> doesn't scale once the
// song library gets big enough that scrolling through it to tag one
// recording becomes the slow part.
function SongTagPicker({ songs, currentSongId, onSelect, onClose }: {
  songs: Song[]
  currentSongId: string | null
  onSelect: (songId: string | null) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim()
  const results = (q
    ? songs
        .map(s => ({ song: s, score: similarity(q, s.title) }))
        .filter(x => x.score >= FUZZY_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .map(x => x.song)
    : songs
  ).slice(0, 6)

  return (
    <div className="mt-2 rounded-md bg-brand-50 px-2.5 py-2">
      <div className="mb-1.5 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-brand-300" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search songs…"
            className="w-full rounded border border-brand-200 bg-white py-1 pl-6 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>
        <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-36 space-y-0.5 overflow-y-auto">
        {currentSongId && (
          <button onClick={() => onSelect(null)} className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-gray-500 hover:bg-white">
            <X className="h-3 w-3" /> Remove tag
          </button>
        )}
        {results.length === 0 ? (
          <p className="px-2 py-1 text-xs text-gray-400">No songs found</p>
        ) : (
          results.map(s => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-white',
                s.id === currentSongId ? 'font-semibold text-brand-700' : 'text-gray-700'
              )}
            >
              <span className="truncate">{s.title}</span>
              {s.id === currentSongId && <Check className="h-3 w-3 shrink-0" />}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export function RecordingsList({ recordings, songs }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // `activeId` is whichever recording is currently loaded into the shared
  // <audio> element — it stays set across a pause, unlike a single
  // "playingId". Reassigning `audio.src` reloads the element from scratch
  // (resets position to 0), so re-fetching a signed URL and re-setting
  // `src` must only happen when actually switching to a *different*
  // recording, never on a plain pause/resume of the one already loaded.
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isPlayingNow, setIsPlayingNow] = useState(false)
  const [currentTime, setCurrentTime] = useState(0) // seconds, active row only
  const [liveDuration, setLiveDuration] = useState<number | null>(null) // from the audio element once its metadata loads
  const [editingId, setEditingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [taggingId, setTaggingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const toast = useToast()

  const handleTogglePlay = async (recording: RecordingWithSong) => {
    const audio = audioRef.current
    if (!audio) return

    if (activeId === recording.id) {
      // Already loaded — just pause/resume in place, keeping position.
      if (isPlayingNow) {
        audio.pause()
        setIsPlayingNow(false)
      } else {
        await audio.play()
        setIsPlayingNow(true)
      }
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
      setActiveId(recording.id)
      setIsPlayingNow(true)
      setCurrentTime(0)
      setLiveDuration(null)
    } catch {
      toast('Failed to play recording', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleTimeUpdate = () => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(audio.currentTime)
  }

  const handleLoadedMetadata = () => {
    const audio = audioRef.current
    if (audio && Number.isFinite(audio.duration)) setLiveDuration(audio.duration)
  }

  // Dragging or tapping anywhere on the slider jumps playback there — a
  // passive progress bar isn't a player, being able to jump to a section
  // is the whole point.
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const value = Number(e.target.value)
    audio.currentTime = value
    setCurrentTime(value)
  }

  const startEditing = (recording: RecordingWithSong) => {
    setEditingId(recording.id)
    setRenameDraft(recording.title)
  }

  const handleRenameSave = async (id: string) => {
    const title = renameDraft
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
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          // A natural end-of-track rewind, unlike a user-initiated pause —
          // only this resets position, so replaying starts over instead of
          // trying to play from the end.
          if (audioRef.current) audioRef.current.currentTime = 0
          setIsPlayingNow(false)
          setCurrentTime(0)
        }}
        className="hidden"
      />

      {recordings.map(r => {
        const isActive = activeId === r.id
        const isPlaying = isActive && isPlayingNow
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
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={renameDraft}
                      onChange={e => setRenameDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameSave(r.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="w-full min-w-0 rounded border border-brand-300 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                    <button onClick={() => handleRenameSave(r.id)} className="shrink-0 text-brand-600 hover:text-brand-800" aria-label="Save">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="shrink-0 text-gray-400 hover:text-gray-600" aria-label="Cancel">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
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

            {isActive && (
              <div className="mt-2 flex items-center gap-2">
                <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-gray-400">{formatDuration(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={liveDuration ?? r.duration_seconds ?? 0}
                  step={0.1}
                  value={Math.min(currentTime, liveDuration ?? r.duration_seconds ?? 0)}
                  onChange={handleSeek}
                  className="h-1 flex-1 cursor-pointer accent-brand-400"
                  aria-label="Seek"
                />
                <span className="w-9 shrink-0 text-[10px] tabular-nums text-gray-400">{formatDuration(liveDuration ?? r.duration_seconds)}</span>
              </div>
            )}

            {isTagging && (
              <SongTagPicker
                songs={songs}
                currentSongId={r.song_id}
                onSelect={songId => handleTag(r.id, songId)}
                onClose={() => setTaggingId(null)}
              />
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
