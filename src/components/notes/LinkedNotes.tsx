import Link from 'next/link'
import { Lock, Plus, StickyNote } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SectionLabel } from '@/components/ui/SectionLabel'

/** Notes attached to a show or song. Private notes only appear for their author (the database enforces it). */
export async function LinkedNotes({ showId, songId }: { showId?: string; songId?: string }) {
  const supabase = await createClient()
  const base = supabase
    .from('notes')
    .select('id, title, content, visibility')
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(6)
  const { data } = showId ? await base.eq('show_id', showId) : await base.eq('song_id', songId ?? '')
  const notes = data ?? []
  const newHref = `/notes?new=1&${showId ? `show=${showId}` : `song=${songId}`}`

  return (
    <section className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>Notes</SectionLabel>
        <Link href={newHref} className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline">
          <Plus className="h-3.5 w-3.5" /> Add note
        </Link>
      </div>
      {notes.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-gray-400"><StickyNote className="h-4 w-4" /> No notes yet for this {showId ? 'show' : 'song'}.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map(n => (
            <li key={n.id}>
              <Link href={`/notes?open=${n.id}`} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-brand-50">
                {n.visibility === 'private' && <Lock className="mt-1 h-3 w-3 shrink-0 text-gray-400" aria-label="Only you" />}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-gray-900">{n.title || n.content?.split('\n')[0] || 'Untitled'}</span>
                  {n.title && n.content && <span className="block truncate text-xs text-gray-500">{n.content.split('\n')[0]}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
