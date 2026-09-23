import { getCachedUser, getCachedRecordings, getCachedSongs } from '@/lib/data'
import { RecordButton } from '@/components/recordings/RecordButton'
import { RecordingsList } from '@/components/recordings/RecordingsList'
import type { RecordingWithSong } from '@/types'

export default async function RecordingsPage() {
  const [{ data: { user } }, recordings, songs] = await Promise.all([
    getCachedUser(),
    getCachedRecordings(),
    getCachedSongs(),
  ])

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Recordings</h1>
      <p className="mb-6 text-sm text-gray-500">Voice memos for original ideas — record, save, and tag one to a song whenever you want.</p>

      {user && (
        <div className="mb-6">
          <RecordButton userId={user.id} />
        </div>
      )}

      <RecordingsList
        recordings={recordings as RecordingWithSong[]}
        songs={songs.map(s => ({ id: s.id, title: s.title }))}
      />
    </div>
  )
}
