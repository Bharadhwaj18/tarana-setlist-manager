import { SongForm } from '@/components/songs/SongForm'
import { createSong } from '@/actions/songs'

export default function NewSongPage() {
  return <SongForm title="New song" backHref="/songs" backLabel="Songs" onSubmit={createSong} />
}
