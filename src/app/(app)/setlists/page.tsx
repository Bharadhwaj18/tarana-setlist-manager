import Link from 'next/link'
import { Plus, ListMusic } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SetlistSearchList } from '@/components/setlists/SetlistSearchList'
import { Button } from '@/components/ui/Button'

export default async function SetlistsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: setlists }, { data: counts }] = await Promise.all([
    supabase.from('setlists').select('*').order('show_date', { ascending: false, nullsFirst: false }),
    supabase.from('setlist_songs').select('setlist_id'),
  ])

  const countMap: Record<string, number> = {}
  counts?.forEach(({ setlist_id }) => {
    countMap[setlist_id] = (countMap[setlist_id] ?? 0) + 1
  })

  // Build profile name map
  const userIds = [...new Set([
    ...(setlists ?? []).map(s => s.created_by),
    ...(setlists ?? []).flatMap(s => s.updated_by ? [s.updated_by] : []),
  ])]

  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, display_name').in('id', userIds)
    : { data: [] }

  const profileMap: Record<string, string> = {}
  for (const p of profiles ?? []) {
    profileMap[p.id] = p.id === user?.id ? 'You' : (p.display_name ?? 'Band member')
  }
  if (user && !profileMap[user.id]) profileMap[user.id] = 'You'

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Setlists</h1>
          <p className="mt-1 text-sm text-gray-500">{setlists?.length ?? 0} setlists</p>
        </div>
        <Button asChild>
          <Link href="/setlists/new">
            <Plus className="h-4 w-4" /> New Setlist
          </Link>
        </Button>
      </div>

      {!setlists?.length ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <ListMusic className="h-12 w-12 text-gray-300" />
          <div>
            <p className="font-medium text-gray-500">No setlists yet</p>
            <p className="text-sm text-gray-400">Create a setlist for your next show</p>
          </div>
          <Button asChild>
            <Link href="/setlists/new">
              <Plus className="h-4 w-4" /> Create a setlist
            </Link>
          </Button>
        </div>
      ) : (
        <SetlistSearchList setlists={setlists} countMap={countMap} profileMap={profileMap} />
      )}
    </div>
  )
}
