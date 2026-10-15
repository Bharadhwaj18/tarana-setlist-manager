'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { StatusPill } from '@/components/ui/StatusPill'
import { cn } from '@/lib/utils'
import type { Song } from '@/types'

interface SortableSongRowProps {
  id: string
  song: Song
  index: number
  setlistId: string
  onRemove: () => void
}

export function SortableSongRow({ id, song, index, setlistId, onRemove }: SortableSongRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const hasChart = !!song.chord_chart?.trim()

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'animate-row-in relative flex items-center gap-3 border-b border-brand-100 bg-white px-4 py-3 last:border-b-0',
        isDragging && 'drag-lifted z-10 rounded-lg opacity-80 ring-2 ring-brand-400'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-gray-300 hover:text-gray-600 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Position number */}
      <span className="w-5 shrink-0 text-center text-sm font-bold text-gray-400">{index + 1}</span>

      {/* Song info — tappable link to song page */}
      <Link href={`/songs/${song.id}?from=/setlists/${setlistId}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-gray-900">{song.title}</p>
          {song.artist && <p className="truncate text-xs text-gray-500">{song.artist}</p>}
        </div>
        {!hasChart && <StatusPill tone="amber" className="shrink-0">No chart</StatusPill>}
        {song.song_key && <StatusPill tone="green" className="shrink-0 rounded-md px-2 text-xs">{song.song_key}</StatusPill>}
        {song.bpm && <span className="hidden w-16 shrink-0 text-right text-sm text-gray-500 sm:block">{song.bpm} BPM</span>}
      </Link>

      {/* Actions */}
      <button
        onClick={onRemove}
        className="text-gray-300 hover:text-red-500"
        aria-label="Remove from setlist"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
