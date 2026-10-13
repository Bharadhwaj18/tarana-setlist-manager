import Link from 'next/link'
import { Plus, ListMusic } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCachedSetlists, getCachedSetlistSongCounts } from '@/lib/data'
import { todayISO } from '@/lib/shows'
import { SetlistsBrowser, type PreviewSong } from '@/components/setlists/SetlistsBrowser'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'

const PREVIEW_SONGS = 5

export default async function SetlistsPage() {
  const supabase = await createClient()
  const [setlists, counts, { data: songRows }] = await Promise.all([
    getCachedSetlists(),
    getCachedSetlistSongCounts(),
    supabase.from('setlist_songs').select('setlist_id, position, song:songs(id, title, artist, song_key)').order('position'),
  ])

  const countMap: Record<string, number> = {}
  counts.forEach(({ setlist_id }) => {
    countMap[setlist_id] = (countMap[setlist_id] ?? 0) + 1
  })

  const previews: Record<string, PreviewSong[]> = {}
  for (const row of songRows ?? []) {
    const song = row.song
    if (!song) continue
    const list = (previews[row.setlist_id] ??= [])
    if (list.length < PREVIEW_SONGS) list.push({ id: song.id, title: song.title, artist: song.artist, key: song.song_key })
  }

  const today = todayISO()
  const upcomingCount = setlists.filter(s => s.show_date && s.show_date >= today).length

  const newButton = (
    <Button asChild>
      <Link href="/setlists/new">
        <Plus className="h-4 w-4" /> New setlist
      </Link>
    </Button>
  )

  return (
    <div>
      <PageHeader
        title="Setlists"
        subtitle={`${setlists.length} ${setlists.length === 1 ? 'setlist' : 'setlists'}${upcomingCount ? ` · ${upcomingCount} for upcoming shows` : ''}`}
        action={newButton}
      />

      {!setlists.length ? (
        <EmptyState
          icon={<ListMusic className="h-12 w-12" />}
          title="No setlists yet"
          description="Create a setlist for your next show"
          action={newButton}
        />
      ) : (
        <SetlistsBrowser setlists={setlists} countMap={countMap} previews={previews} today={today} />
      )}
    </div>
  )
}
