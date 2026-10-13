'use client'

import { useState } from 'react'
import { Check, Link2, Lock, Plus, Users, X } from 'lucide-react'
import type { ChecklistItemInput, NoteFormData } from '@/actions/notes'
import { cn } from '@/lib/utils'
import { NOTE_COLORS, NOTE_COLOR_CLASSES, NOTE_TEMPLATES, type NoteTemplate, type NoteVisibility } from '@/types/notes'
import type { Note, ChecklistItem } from '@/types'

export interface NoteFields {
  title: string
  content: string
  color: string
  labels: string
  checklist: ChecklistItemInput[]
  visibility: NoteVisibility
  showId: string
  songId: string
  pinned: boolean
}

export interface LinkTargets {
  shows: { id: string; title: string; date: string | null }[]
  songs: { id: string; title: string }[]
}

export const emptyFields = (over: Partial<NoteFields> = {}): NoteFields => ({
  title: '', content: '', color: '', labels: '', checklist: [], visibility: 'private', showId: '', songId: '', pinned: false, ...over,
})

export function fieldsFrom(note: Note, items: ChecklistItem[]): NoteFields {
  return {
    title: note.title,
    content: note.content ?? '',
    color: note.color ?? '',
    labels: (note.labels ?? []).join(', '),
    checklist: items.map((i): ChecklistItemInput => ({ id: i.id, text: i.text, done: i.done })),
    visibility: note.visibility === 'shared' ? 'shared' : 'private',
    showId: note.show_id ?? '',
    songId: note.song_id ?? '',
    pinned: note.pinned,
  }
}

export function toFormData(f: NoteFields): NoteFormData {
  return {
    title: f.title,
    content: f.content,
    pinned: f.pinned,
    color: f.color || null,
    labels: f.labels.split(',').map(l => l.trim()).filter(Boolean),
    checklistItems: f.checklist,
    visibility: f.visibility,
    showId: f.showId || null,
    songId: f.songId || null,
  }
}

export const hasContent = (f: NoteFields) => !!f.title.trim() || !!f.content.trim() || f.checklist.some(i => i.text.trim())

export const applyTemplate = (f: NoteFields, t: NoteTemplate): NoteFields => ({
  ...f,
  title: f.title || t.title,
  content: f.content || t.content || '',
  checklist: f.checklist.length ? f.checklist : (t.items ?? []).map(text => ({ text, done: false })),
})

interface Props {
  fields: NoteFields
  onChange: (next: NoteFields) => void
  links: LinkTargets
  /** Only the author may flip a note between private and shared. */
  canChangeVisibility?: boolean
  showTemplates?: boolean
  autoFocus?: boolean
}

const inputBase = 'w-full bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none'

export function NoteForm({ fields, onChange, links, canChangeVisibility = true, showTemplates = false, autoFocus = false }: Props) {
  const [newItem, setNewItem] = useState('')
  const [linkOpen, setLinkOpen] = useState(!!(fields.showId || fields.songId))
  const set = <K extends keyof NoteFields>(key: K, value: NoteFields[K]) => onChange({ ...fields, [key]: value })

  const addItem = () => {
    const text = newItem.trim()
    if (!text) return
    set('checklist', [...fields.checklist, { text, done: false }])
    setNewItem('')
  }
  const setItem = (i: number, patch: Partial<ChecklistItemInput>) => set('checklist', fields.checklist.map((it, j) => (j === i ? { ...it, ...patch } : it)))

  const empty = !hasContent(fields)
  const open = fields.checklist.filter(i => !i.done)
  const done = fields.checklist.filter(i => i.done)
  const indexOf = (it: ChecklistItemInput) => fields.checklist.indexOf(it)

  const row = (it: ChecklistItemInput) => {
    const i = indexOf(it)
    return (
      <div key={it.id ?? `n-${i}`} className="group flex items-center gap-2">
        <button
          type="button"
          onClick={() => setItem(i, { done: !it.done })}
          aria-label={it.done ? 'Mark not done' : 'Mark done'}
          className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border-2', it.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300')}
        >
          {it.done && <Check className="h-2.5 w-2.5" />}
        </button>
        <input
          value={it.text}
          onChange={e => setItem(i, { text: e.target.value })}
          aria-label="Checklist item"
          className={cn('min-w-0 flex-1 bg-transparent text-sm focus:outline-none', it.done ? 'text-gray-400 line-through' : 'text-gray-800')}
        />
        <button type="button" onClick={() => set('checklist', fields.checklist.filter((_, j) => j !== i))} className="shrink-0 text-gray-300 opacity-0 hover:text-red-500 group-hover:opacity-100 focus:opacity-100" aria-label="Remove item">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {showTemplates && empty && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-400">Start from</span>
          {NOTE_TEMPLATES.map(t => (
            <button key={t.id} type="button" onClick={() => onChange(applyTemplate(fields, t))} className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-brand-200">
              {t.label}
            </button>
          ))}
        </div>
      )}

      <input aria-label="Title" placeholder="Title" value={fields.title} onChange={e => set('title', e.target.value)} autoFocus={autoFocus} className={cn(inputBase, 'text-base font-bold')} />
      <textarea
        aria-label="Note"
        placeholder="Take a note..."
        rows={fields.content.split('\n').length > 3 ? Math.min(14, fields.content.split('\n').length + 1) : 3}
        value={fields.content}
        onChange={e => set('content', e.target.value)}
        className={cn(inputBase, 'resize-none text-sm')}
      />

      {(
        <div className="space-y-1.5">
          {open.map(row)}
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              aria-label="Add a list item"
              placeholder="List item"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
              onBlur={addItem}
              className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
            />
          </div>
          {done.length > 0 && (
            <div className="space-y-1.5 border-t border-brand-100 pt-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Ticked · {done.length}</p>
              {done.map(row)}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-brand-100 pt-3">
        <div className="flex items-center gap-1.5" role="group" aria-label="Colour">
          <button type="button" onClick={() => set('color', '')} aria-label="No colour" className={cn('h-5 w-5 rounded-full border-2 bg-white', fields.color === '' ? 'border-brand-500' : 'border-gray-200')} />
          {NOTE_COLORS.map(c => (
            <button key={c} type="button" onClick={() => set('color', c)} aria-label={c} className={cn('h-5 w-5 rounded-full border-2', NOTE_COLOR_CLASSES[c].split(' ')[0], fields.color === c ? 'border-brand-500' : 'border-transparent')} />
          ))}
        </div>

        <div className={cn('inline-flex rounded-full bg-brand-100 p-0.5 text-xs font-bold', !canChangeVisibility && 'opacity-60')} role="group" aria-label="Who can see this">
          {([['private', 'Only me', Lock], ['shared', 'Workspace', Users]] as const).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              disabled={!canChangeVisibility}
              aria-pressed={fields.visibility === v}
              onClick={() => set('visibility', v)}
              className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1', fields.visibility === v ? 'bg-brand-400 text-white' : 'text-gray-600')}
            >
              <Icon className="h-3 w-3" /> {label}
            </button>
          ))}
        </div>

        <button type="button" onClick={() => setLinkOpen(v => !v)} className={cn('inline-flex items-center gap-1 text-xs font-bold', linkOpen || fields.showId || fields.songId ? 'text-brand-600' : 'text-gray-500 hover:text-gray-800')}>
          <Link2 className="h-3.5 w-3.5" /> Link to a show or song
        </button>
      </div>

      {linkOpen && (
        <div className="grid gap-2 sm:grid-cols-2">
          <select aria-label="Show" value={fields.showId} onChange={e => set('showId', e.target.value)} className="compact-field rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-sm text-gray-800">
            <option value="">No show</option>
            {links.shows.map(s => <option key={s.id} value={s.id}>{s.title}{s.date ? ` · ${s.date}` : ''}</option>)}
          </select>
          <select aria-label="Song" value={fields.songId} onChange={e => set('songId', e.target.value)} className="compact-field rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-sm text-gray-800">
            <option value="">No song</option>
            {links.songs.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
      )}

      <input aria-label="Labels" placeholder="Labels, comma separated (gigs, ideas)" value={fields.labels} onChange={e => set('labels', e.target.value)} className={cn(inputBase, 'text-xs')} />
    </div>
  )
}
