import Link from 'next/link'
import { Plus, Music2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SongSearchList } from '@/components/songs/SongSearchList'
import { Button } from '@/components/ui/Button'

export default async function SongsPage() {
  const supabase = await createClient()
  const { data: songs } = await supabase
    .from('songs')
    .select('*')
    .order('title')

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Song Library</h1>
          <p className="mt-1 text-sm text-gray-500">{songs?.length ?? 0} songs</p>
        </div>
        <Button asChild>
          <Link href="/songs/new">
            <Plus className="h-4 w-4" />
            New Song
          </Link>
        </Button>
      </div>

      {!songs?.length ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <Music2 className="h-12 w-12 text-gray-300" />
          <div>
            <p className="font-medium text-gray-500">No songs yet</p>
            <p className="text-sm text-gray-400">Add your first song to get started</p>
          </div>
          <Button asChild>
            <Link href="/songs/new">
              <Plus className="h-4 w-4" />
              Add a song
            </Link>
          </Button>
        </div>
      ) : (
        <SongSearchList songs={songs} />
      )}
    </div>
  )
}
