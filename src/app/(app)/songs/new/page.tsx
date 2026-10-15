import { SongForm } from '@/components/songs/SongForm'
import { sectionGuard } from '@/lib/section-guard'
import { createSong } from '@/actions/songs'

export default async function NewSongPage() {
  const denied = await sectionGuard('songs')
  if (denied) return denied
  return <SongForm title="New song" backHref="/songs" backLabel="Songs" onSubmit={createSong} />
}
