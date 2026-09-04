import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// getUser() makes a real network round-trip to Supabase's auth server to
// verify the token (unlike getSession(), which just reads the local JWT).
// Middleware, the (app) layout, and every page all call it — without this,
// that's 3+ separate round-trips for a single navigation. cache() collapses
// every call within one request/render pass into the one already in flight.
export const getCachedUser = cache(async () => {
  const supabase = await createClient()
  return supabase.auth.getUser()
})

export const getCachedSongs = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.from('songs').select('*').order('title')
  return data ?? []
})

export const getCachedSetlists = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('setlists')
    .select('*')
    .order('show_date', { ascending: false, nullsFirst: false })
  return data ?? []
})

export const getCachedSetlistSongCounts = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.from('setlist_songs').select('setlist_id')
  return data ?? []
})

export const getCachedSong = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase.from('songs').select('*').eq('id', id).single()
  return data
})

export const getCachedSetlist = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase.from('setlists').select('*').eq('id', id).single()
  return data
})

export const getCachedSetlistSongs = cache(async (setlistId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('setlist_songs')
    .select('*, song:songs(*)')
    .eq('setlist_id', setlistId)
    .order('position')
  return data ?? []
})

export const getCachedAllProfiles = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('id, display_name')
  return data ?? []
})
