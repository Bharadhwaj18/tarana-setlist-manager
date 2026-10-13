'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Archive, ArchiveRestore, Check, CalendarDays, Lock, Music2, Palette, Pin, RotateCcw, Trash2, Users } from 'lucide-react'
import { NoteModal } from './NoteModal'
import type { LinkTargets } from './NoteForm'
import { deleteNote, deleteNoteForever, restoreNote, setNoteColor, setNoteVisibility, toggleChecklistItem, toggleArchive, togglePin } from '@/actions/notes'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import { linkifyText } from '@/lib/linkify'
import { NOTE_COLORS, NOTE_COLOR_CLASSES, type NoteColor } from '@/types/notes'
import type { Note, ChecklistItem } from '@/types'

interface Props {
  note: Note
  checklistItems: ChecklistItem[]
  /** Already resolved to a display string: never pass a function across the server/client boundary. */
  authorLine: string
  links: LinkTargets
  isMine: boolean
  inTrash?: boolean
  startOpen?: boolean
}

const MAX_PREVIEW_ITEMS = 8

export function NoteCard({ note, checklistItems, authorLine, links, isMine, inTrash = false, startOpen = false }: Props) {
  const [editOpen, setEditOpen] = useState(startOpen)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [, startTransition] = useTransition()
  const toast = useToast()

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  const run = (fn: () => Promise<{ error?: string }>, message?: string) =>
    startTransition(async () => {
      const result = await fn()
      if (result.error) toast(result.error, 'error')
      else if (message) toast(message, 'success')
    })

  const open = checklistItems.filter(i => !i.done)
  const done = checklistItems.filter(i => i.done)
  const shown = [...open, ...done].slice(0, MAX_PREVIEW_ITEMS)
  const hidden = checklistItems.length - shown.length
  const shared = note.visibility === 'shared'
  const linkedShow = note.show_id ? links.shows.find(s => s.id === note.show_id) : undefined
  const linkedSong = note.song_id ? links.songs.find(s => s.id === note.song_id) : undefined
  const colorClasses = note.color && note.color in NOTE_COLOR_CLASSES ? NOTE_COLOR_CLASSES[note.color as NoteColor] : 'bg-white border-brand-200'

  const iconBtn = 'rounded-md p-1.5 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !inTrash && setEditOpen(true)}
      onKeyDown={e => { if (!inTrash && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setEditOpen(true) } }}
      className={cn('group relative flex min-w-0 flex-col gap-2 rounded-2xl border p-4 text-left shadow-sm transition-shadow hover:shadow-md', !inTrash && 'cursor-pointer', colorClasses)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 break-words font-bold text-gray-900">{note.title}</p>
        {!inTrash && (
          <button type="button" onClick={e => { stop(e); run(() => togglePin(note.id, !note.pinned)) }} aria-label={note.pinned ? 'Unpin' : 'Pin'}
            className={cn('shrink-0 rounded-md p-1.5 hover:bg-black/5', note.pinned ? 'text-amber-500' : 'text-gray-300')}>
            <Pin className={cn('h-4 w-4', note.pinned && 'fill-current')} />
          </button>
        )}
      </div>

      {note.content && <p className="whitespace-pre-wrap break-words text-sm text-gray-600">{linkifyText(note.content)}</p>}

      {shown.length > 0 && (
        <div className="space-y-0.5">
          {shown.map(item => (
            <div
              key={item.id}
              onClick={e => { stop(e); if (!inTrash) run(() => toggleChecklistItem(item.id, !item.done)) }}
              className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-black/5"
            >
              <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border-2', item.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300')}>
                {item.done && <Check className="h-2.5 w-2.5" />}
              </span>
              <span className={cn('min-w-0 flex-1 break-words text-sm text-gray-700', item.done && 'text-gray-400 line-through')}>{item.text}</span>
            </div>
          ))}
          {hidden > 0 && <p className="pl-6 text-xs text-gray-400">+ {hidden} more</p>}
        </div>
      )}

      {(linkedShow || linkedSong || (note.labels ?? []).length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {linkedShow && (
            <Link href={`/shows/${linkedShow.id}`} onClick={stop} className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-bold text-gray-700 hover:bg-black/10">
              <CalendarDays className="h-3 w-3" /> {linkedShow.title}
            </Link>
          )}
          {linkedSong && (
            <Link href={`/songs/${linkedSong.id}`} onClick={stop} className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-bold text-gray-700 hover:bg-black/10">
              <Music2 className="h-3 w-3" /> {linkedSong.title}
            </Link>
          )}
          {(note.labels ?? []).map(label => (
            <span key={label} className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-gray-600">{label}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-gray-400">
          {shared ? <Users className="h-3 w-3 shrink-0" aria-label="Shared with the workspace" /> : <Lock className="h-3 w-3 shrink-0" aria-label="Only you" />}
          <span className="truncate">{shared ? authorLine : 'Only you'}</span>
        </p>
        <div className="flex shrink-0 items-center" onClick={stop}>
          {inTrash ? (
            <>
              <button type="button" onClick={() => run(() => restoreNote(note.id), 'Note restored')} className={iconBtn} aria-label="Restore"><RotateCcw className="h-4 w-4" /></button>
              <button type="button" onClick={() => { if (window.confirm('Delete this note forever?')) run(() => deleteNoteForever(note.id)) }} className={cn(iconBtn, 'hover:bg-red-50 hover:text-red-500')} aria-label="Delete forever"><Trash2 className="h-4 w-4" /></button>
            </>
          ) : (
            <>
              <div className="relative">
                <button type="button" onClick={() => setPaletteOpen(v => !v)} className={iconBtn} aria-label="Colour"><Palette className="h-4 w-4" /></button>
                {paletteOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setPaletteOpen(false)} />
                    <div className="absolute bottom-full right-0 z-30 mb-1 flex gap-1.5 rounded-xl border border-brand-200 bg-white p-2 shadow-lg">
                      <button type="button" onClick={() => { setPaletteOpen(false); run(() => setNoteColor(note.id, null)) }} aria-label="No colour" className="h-6 w-6 rounded-full border-2 border-gray-200 bg-white" />
                      {NOTE_COLORS.map(c => (
                        <button key={c} type="button" onClick={() => { setPaletteOpen(false); run(() => setNoteColor(note.id, c)) }} aria-label={c} className={cn('h-6 w-6 rounded-full border-2 border-transparent', NOTE_COLOR_CLASSES[c].split(' ')[0])} />
                      ))}
                    </div>
                  </>
                )}
              </div>
              {isMine && (
                <button
                  type="button"
                  onClick={() => run(() => setNoteVisibility(note.id, shared ? 'private' : 'shared'), shared ? 'Now only you can see this note' : 'Shared with the workspace')}
                  className={iconBtn}
                  aria-label={shared ? 'Make private' : 'Share with the workspace'}
                  title={shared ? 'Make private' : 'Share with the workspace'}
                >
                  {shared ? <Lock className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                </button>
              )}
              <button type="button" onClick={() => run(() => toggleArchive(note.id, !note.archived_at))} className={iconBtn} aria-label={note.archived_at ? 'Unarchive' : 'Archive'}>
                {note.archived_at ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => run(() => deleteNote(note.id), 'Moved to Trash')} className={cn(iconBtn, 'hover:bg-red-50 hover:text-red-500')} aria-label="Move to Trash"><Trash2 className="h-4 w-4" /></button>
            </>
          )}
        </div>
      </div>

      {/* Portalled dialogs still bubble clicks up the React tree, so stop them re-triggering the card. */}
      <div onClick={stop}>
        <NoteModal note={note} checklistItems={checklistItems} links={links} canChangeVisibility={isMine} open={editOpen} onOpenChange={setEditOpen} />
      </div>
    </div>
  )
}
