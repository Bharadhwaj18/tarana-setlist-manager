import Link from 'next/link'
import { sectionGuard } from '@/lib/section-guard'
import { Plus, Music2 } from 'lucide-react'
import { getCachedSongs, getCachedSetlistSongCounts, getCachedReferenceRows } from '@/lib/data'
import { coverLinksBySong, firstReferenceBySong, type PlayableSong } from '@/lib/song-references'
import { SongSearchList } from '@/components/songs/SongSearchList'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

export default async function SongsPage() {
  const denied = await sectionGuard('songs')
  if (denied) return denied
  const [songs, usage, referenceRows] = await Promise.all([getCachedSongs(), getCachedSetlistSongCounts(), getCachedReferenceRows()])

  const setlistCounts: Record<string, number> = {}
  for (const row of usage) setlistCounts[row.song_id] = (setlistCounts[row.song_id] ?? 0) + 1

  // Songs with a reference the app can play get a play button in the list.
  const firstRef = firstReferenceBySong(referenceRows)
  const playables: Record<string, PlayableSong> = {}
  for (const s of songs) {
    const reference = firstRef[s.id]
    if (reference) playables[s.id] = { songId: s.id, title: s.title, artist: s.artist, songKey: s.song_key, coverUrl: s.cover_url, reference }
  }
  const withRef = new Set(referenceRows.map(r => r.song_id)).size
  const coverLinks = coverLinksBySong(referenceRows, songs)

  const needChart = songs.filter(s => !s.chord_chart).length
  const subtitle = `${songs.length} ${songs.length === 1 ? 'song' : 'songs'}${withRef ? ` · ${withRef} with a reference` : ''}${needChart ? ` · ${needChart} still need a chord chart` : ''}`

  return (
    <div>
      <PageHeader
        title="Songs"
        subtitle={subtitle}
        action={
          <Button asChild>
            <Link href="/songs/new"><Plus className="h-4 w-4" /> New song</Link>
          </Button>
        }
      />

      {!songs.length ? (
        <EmptyState
          icon={<Music2 className="h-12 w-12" />}
          title="No songs yet"
          description="Add your first song to get started"
          action={<Button asChild><Link href="/songs/new"><Plus className="h-4 w-4" /> Add a song</Link></Button>}
        />
      ) : (
        <SongSearchList songs={songs} setlistCounts={setlistCounts} playables={playables} coverLinks={coverLinks} />
      )}
    </div>
  )
}
