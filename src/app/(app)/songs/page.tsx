import Link from 'next/link'
import { Plus, Music2 } from 'lucide-react'
import { getCachedSongs } from '@/lib/data'
import { createClient } from '@/lib/supabase/server'
import { SongSearchList } from '@/components/songs/SongSearchList'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

export default async function SongsPage() {
  const supabase = await createClient()
  const [songs, { data: usage }] = await Promise.all([
    getCachedSongs(),
    supabase.from('setlist_songs').select('song_id'),
  ])

  const setlistCounts: Record<string, number> = {}
  for (const row of usage ?? []) setlistCounts[row.song_id] = (setlistCounts[row.song_id] ?? 0) + 1

  const needChart = songs.filter(s => !s.chord_chart).length
  const subtitle = `${songs.length} ${songs.length === 1 ? 'song' : 'songs'}${needChart ? ` · ${needChart} still need a chord chart` : ''}`

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
        <SongSearchList songs={songs} setlistCounts={setlistCounts} />
      )}
    </div>
  )
}
