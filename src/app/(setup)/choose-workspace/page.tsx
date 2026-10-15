import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/auth-cache'
import { getWorkspaceOptions } from '@/lib/workspace-options-server'
import { safeNextPath } from '@/lib/safe-redirect'
import { todayISO } from '@/lib/shows'
import { BrandMark } from '@/components/ui/BrandMark'
import { Wordmark } from '@/components/ui/Wordmark'
import { WorkspacePicker } from '@/components/workspaces/WorkspacePicker'

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()))
  if (hour < 5) return 'Up late'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function ChooseWorkspacePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { data: { user } } = await getCachedUser()
  if (!user) redirect('/login')
  const { next } = await searchParams

  const supabase = await createClient()
  const [{ data: profile }, { options, currentId }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
    getWorkspaceOptions(),
  ])
  if (!profile?.display_name?.trim()) redirect('/setup')
  const firstName = profile.display_name.trim().split(/\s+/)[0]

  return (
    <div className="w-full max-w-5xl py-10">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-9 w-9" />
          <Wordmark className="text-xl text-gray-900" />
        </div>
        {currentId && (
          <Link href="/" className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 hover:bg-white/60">
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
        )}
      </div>
      <p className="text-sm font-semibold text-gray-600">{greeting()}, {firstName}</p>
      <h1 className="mb-6 mt-1 font-display text-3xl font-bold text-gray-900 sm:text-4xl">Where are you working today?</h1>
      <WorkspacePicker options={options} lastUsedId={currentId} today={todayISO()} next={safeNextPath(next)} />
      <p className="mt-8 text-center text-xs text-gray-500">You can switch any time from the workspace name at the top of the menu.</p>
    </div>
  )
}
