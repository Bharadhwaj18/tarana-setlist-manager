import type { Database } from './database'

// A voice memo — standalone by default, optionally tagged to a Song (the
// tag is editable anytime, not just at record time). `file_path` is the
// object's path inside the private `recordings` Storage bucket, not a
// public URL; playback always goes through a short-lived signed URL.
export type Recording = Database['public']['Tables']['recordings']['Row']
export type RecordingInsert = Omit<Recording, 'id' | 'created_at'>
export type RecordingUpdate = Partial<RecordingInsert>

type SongRow = Database['public']['Tables']['songs']['Row']
export type RecordingWithSong = Recording & { song: Pick<SongRow, 'id' | 'title'> | null }
