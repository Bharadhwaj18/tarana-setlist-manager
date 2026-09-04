'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { Tag } from 'lucide-react'
import { SortableSongRow } from './SortableSongRow'
import { reorderSetlistSongs, removeSongFromSetlist } from '@/actions/setlists'
import { useToast } from '@/components/ui/Toaster'
import type { SetlistSongWithSong } from '@/types'

interface SetlistSongListProps {
  setlistId: string
  initialItems: SetlistSongWithSong[]
}

export function SetlistSongList({ setlistId, initialItems }: SetlistSongListProps) {
  const [items, setItems] = useState(initialItems)
  const toast = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)

    // Moved item inherits the section of the song now directly above it,
    // or the song below if dropped at position 0
    const newSection = newIndex > 0
      ? (reordered[newIndex - 1].section ?? null)
      : (reordered[newIndex + 1]?.section ?? null)

    const withSection = reordered.map((item, idx) =>
      idx === newIndex ? { ...item, section: newSection } : item
    )

    setItems(withSection)

    reorderSetlistSongs(
      setlistId,
      withSection.map(i => ({ songId: i.song_id, section: i.section ?? null }))
    ).catch(() => {
      setItems(items)
      toast('Failed to save order', 'error')
    })
  }

  const handleRemove = async (songId: string) => {
    setItems(prev => prev.filter(i => i.song_id !== songId))
    try {
      await removeSongFromSetlist(setlistId, songId)
    } catch {
      setItems(items)
      toast('Failed to remove song', 'error')
    }
  }

  if (!items.length) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
        No songs added yet. Use &ldquo;Bulk Import&rdquo; or &ldquo;Add Songs&rdquo; to build your setlist.
      </div>
    )
  }

  // Build a flat render list that inserts section headers between section changes
  const renderItems: Array<{ type: 'header'; label: string } | { type: 'song'; item: SetlistSongWithSong; index: number }> = []
  let lastSection: string | null = null
  let songIndex = 0

  for (const item of items) {
    const section = (item as SetlistSongWithSong & { section?: string | null }).section ?? null
    if (section !== lastSection) {
      if (section) {
        renderItems.push({ type: 'header', label: section })
      }
      lastSection = section
    }
    renderItems.push({ type: 'song', item, index: songIndex++ })
  }

  return (
    <DndContext id="setlist-song-list" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {renderItems.map((entry, i) => {
            if (entry.type === 'header') {
              return (
                <div
                  key={`header-${entry.label}-${i}`}
                  className="flex items-center gap-2 pb-1 pt-4 first:pt-0"
                >
                  <Tag className="h-3.5 w-3.5 shrink-0 text-brand-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">
                    {entry.label}
                  </span>
                  <div className="h-px flex-1 bg-brand-200" />
                </div>
              )
            }
            return (
              <SortableSongRow
                key={entry.item.id}
                id={entry.item.id}
                song={entry.item.song}
                index={entry.index}
                setlistId={setlistId}
                onRemove={() => handleRemove(entry.item.song_id)}
              />
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )
}
