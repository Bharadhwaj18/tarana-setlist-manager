import { notFound } from 'next/navigation'
import { sectionGuard } from '@/lib/section-guard'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { SongForm } from '@/components/songs/SongForm'
import { updateSong } from '@/actions/songs'
import { ACTIVE_SETLIST_COOKIE } from '@/lib/setlist-context'
import type { SongFormData } from '@/lib/validators'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}

export default async function EditSongPage({ params, searchParams }: Props) {
  const denied = await sectionGuard('songs')
  if (denied) return denied
  const { id } = await params
  const { from } = await searchParams
  const supabase = await createClient()
  const { data: song } = await supabase.from('songs').select('*').eq('id', id).single()

  if (!song) notFound()

  // Same fallback as the song view page — an explicit `from` wins, otherwise
  // fall back to the last active setlist so editing a song doesn't itself
  // become a way to lose setlist context.
  const explicitSetlistId = from?.match(/^\/setlists\/([^/]+)$/)?.[1] ?? null
  const cookieSetlistId = explicitSetlistId
    ? null
    : (await cookies()).get(ACTIVE_SETLIST_COOKIE)?.value ?? null
  const canonicalFrom = explicitSetlistId
    ? from!
    : cookieSetlistId
      ? `/setlists/${cookieSetlistId}`
      : null

  const handleUpdate = async (data: SongFormData) => {
    'use server'
    const backTo = canonicalFrom ? `/songs/${id}?from=${encodeURIComponent(canonicalFrom)}` : `/songs/${id}`
    await updateSong(id, data, backTo)
  }

  const backHref = canonicalFrom
    ? `/songs/${id}?from=${encodeURIComponent(canonicalFrom)}`
    : `/songs/${id}`

  return <SongForm song={song} title="Edit song" backHref={backHref} backLabel={song.title} onSubmit={handleUpdate} />
}
