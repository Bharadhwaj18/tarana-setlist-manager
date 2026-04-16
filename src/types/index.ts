import type { Database } from './database'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Song = Database['public']['Tables']['songs']['Row']
export type Setlist = Database['public']['Tables']['setlists']['Row']
export type SetlistSong = Database['public']['Tables']['setlist_songs']['Row']

export type SongInsert = Omit<Song, 'id' | 'created_at' | 'updated_at' | 'created_by'>
export type SongUpdate = Partial<SongInsert>
export type SetlistInsert = Omit<Setlist, 'id' | 'created_at' | 'updated_at' | 'created_by'>
export type SetlistUpdate = Partial<SetlistInsert>

export type SetlistSongWithSong = SetlistSong & { song: Song; section?: string | null }
