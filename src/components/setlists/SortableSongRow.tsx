'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Tag } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Song } from '@/types'

const NO_SECTION = ''

interface SortableSongRowProps {
  id: string
  song: Song
  index: number
  setlistId: string
  section: string | null
  availableSections: string[]
  onRemove: () => void
  onSectionChange: (section: string | null) => void
}

export function SortableSongRow({
  id, song, index, setlistId, section, availableSections, onRemove, onSectionChange,
}: SortableSongRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Always offer the song's own current section even if it's since become
  // orphaned (e.g. every other song under it was already cleared).
  const sectionOptions = section && !availableSections.includes(section)
    ? [...availableSections, section]
    : availableSections

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-white px-4 py-3 shadow-sm',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-brand-400'
      )}
    >
      {/* Position number */}
      <span className="w-6 shrink-0 text-center text-sm font-bold text-gray-500">{index + 1}</span>

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-gray-400 hover:text-gray-700 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Song info — tappable link to song page */}
      <Link href={`/songs/${song.id}?from=/setlists/${setlistId}`} className="flex min-w-0 flex-1 items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{song.title}</p>
          {song.artist && <p className="truncate text-xs text-gray-400">{song.artist}</p>}
        </div>
        {song.song_key && (
          <span className="shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-xs font-bold text-brand-700">
            {song.song_key}
          </span>
        )}
      </Link>

      {/* Section — reassign or clear a wrong/mis-parsed section right here */}
      <div className="flex shrink-0 items-center gap-1" title="Section">
        <Tag className="h-3.5 w-3.5 text-brand-300" />
        <select
          value={section ?? NO_SECTION}
          onChange={e => onSectionChange(e.target.value === NO_SECTION ? null : e.target.value)}
          className="rounded-md border border-brand-200 bg-white py-1 pl-1.5 pr-6 text-xs text-gray-600 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          aria-label={`Section for ${song.title}`}
        >
          <option value={NO_SECTION}>No section</option>
          {sectionOptions.map(sec => (
            <option key={sec} value={sec}>{sec}</option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <button
        onClick={onRemove}
        className="text-brand-200 hover:text-red-500"
        aria-label="Remove from setlist"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
