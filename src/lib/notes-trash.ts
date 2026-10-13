import type { createClient } from '@/lib/supabase/server'

export const TRASH_DAYS = 30

/** Removes notes that have sat in the Trash for more than 30 days. Cheap enough to run whenever Notes opens. */
export async function purgeOldTrash(supabase: Awaited<ReturnType<typeof createClient>>) {
  const cutoff = new Date(Date.now() - TRASH_DAYS * 86400000).toISOString()
  await supabase.from('notes').delete().lt('deleted_at', cutoff)
}
