import Link from 'next/link'
import { Plus, ListMusic } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SetlistSearchList } from '@/components/setlists/SetlistSearchList'
import { Button } from '@/components/ui/Button'

export default async function SetlistsPage() {
  const supabase = await createClient()

  const { data: setlists } = await supabase
    .from('setlists')
    .select('*')
    .order('show_date', { ascending: false, nullsFirst: false })

  // Get song counts per setlist
  const { data: counts } = await supabase
    .from('setlist_songs')
    .select('setlist_id')

  const countMap: Record<string, number> = {}
  counts?.forEach(({ setlist_id }) => {
    countMap[setlist_id] = (countMap[setlist_id] ?? 0) + 1
  })

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
        <SetlistSearchList setlists={setlists} countMap={countMap} />
      )}
    </div>
  )
}
