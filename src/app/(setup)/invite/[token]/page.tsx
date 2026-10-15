import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/auth-cache'
import { Button } from '@/components/ui/Button'
import { AcceptInviteButton } from '@/components/workspace/AcceptInviteButton'
import { BrandMark } from '@/components/ui/BrandMark'
import { Wordmark } from '@/components/ui/Wordmark'
import { WorkspaceAvatar } from '@/components/ui/WorkspaceAvatar'
import { SECTIONS, sectionLevelsFrom } from '@/lib/workspace-sections'

const STATE_MESSAGES: Record<string, string> = {
  revoked: 'This invite link was cancelled. Ask whoever invited you for a new one.',
  expired: 'This invite link has expired. Ask whoever invited you for a new one.',
  used_up: 'This invite link has already been used the maximum number of times. Ask for a new one.',
  unavailable: 'This workspace isn’t accepting new members right now.',
}

const formatExpiry = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso))

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc('invite_preview', { p_token: token })
  const invite = data?.[0]
  // What a member joining with this link can open (null = everything, or the function isn't set up yet).
  const { data: rawSections } = await supabase.rpc('invite_sections', { p_token: token })
  const levels = rawSections && typeof rawSections === 'object' && !Array.isArray(rawSections) ? sectionLevelsFrom({ sections: rawSections }, 'member') : null
  const canOpen = levels ? SECTIONS.filter(sec => levels[sec.key] !== 'none').map(sec => (levels[sec.key] === 'view' ? `${sec.label} (view only)` : sec.label)) : null
  const { data: { user } } = await getCachedUser()
  const loginHref = `/login?next=${encodeURIComponent(`/invite/${token}`)}`

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex items-center justify-center gap-2.5">
        <BrandMark className="h-9 w-9" />
        <Wordmark className="text-xl text-gray-900" />
      </div>

      <div className="rounded-3xl border border-brand-200 bg-white p-8 text-center shadow-sm">
        {!invite ? (
          <>
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700"><AlertTriangle className="h-6 w-6" /></span>
            <h1 className="text-xl font-bold text-gray-900">Invite link not found</h1>
            <p className="mt-2 text-sm text-gray-500">Check that you copied the whole link, or ask whoever invited you to send it again.</p>
            <Button asChild variant="secondary" className="mt-6"><Link href="/">Go to my workspaces</Link></Button>
          </>
        ) : invite.state !== 'valid' ? (
          <>
            <WorkspaceAvatar name={invite.workspace_name} color={invite.workspace_color} avatarUrl={invite.workspace_avatar_url} size="xl" className="mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900">{invite.workspace_name}</h1>
            <span className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800"><AlertTriangle className="h-3.5 w-3.5" /> Link can’t be used</span>
            <p className="mt-3 text-sm text-gray-500">{STATE_MESSAGES[invite.state] ?? 'This invite link can’t be used.'}</p>
            <Button asChild variant="secondary" className="mt-6"><Link href="/">Go to my workspaces</Link></Button>
          </>
        ) : (
          <>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-600">You’ve been invited</p>
            <WorkspaceAvatar name={invite.workspace_name} color={invite.workspace_color} avatarUrl={invite.workspace_avatar_url} size="xl" className="mx-auto mt-4" />
            <h1 className="mt-4 font-display text-3xl font-bold text-gray-900">{invite.workspace_name}</h1>
            {invite.invited_by_name && <p className="mt-1.5 text-sm text-gray-500">Invited by <span className="font-bold text-gray-800">{invite.invited_by_name}</span></p>}
            {typeof invite.member_count === 'number' && invite.member_count > 0 && (
              <p className="mt-1 text-sm text-gray-500">{invite.member_count} {invite.member_count === 1 ? 'member' : 'members'} already in</p>
            )}
            <span className="mt-4 inline-flex rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700">
              You’ll join as {invite.invite_role === 'admin' ? 'an Admin' : 'a Member'}
            </span>
            {canOpen && (
              <p className="mt-3 text-sm text-gray-600">
                {canOpen.length === 0 ? 'An admin will choose what you can open after you join.' : <>You’ll be able to open: <span className="font-semibold text-gray-800">{canOpen.join(', ')}</span></>}
              </p>
            )}

            {user ? (
              <div className="mt-6 space-y-2">
                <AcceptInviteButton token={token} />
                <p className="pt-1 text-xs text-gray-400">Signed in as {user.email}</p>
              </div>
            ) : (
              <div className="mt-6 space-y-2">
                <Button asChild className="w-full"><Link href={loginHref}>Sign in to join</Link></Button>
                <Button asChild variant="secondary" className="w-full"><Link href={loginHref}>Create an account</Link></Button>
                <p className="pt-1 text-xs text-gray-400">New here? Choose “Magic Link” on the next screen and we’ll email you a sign-in link. You’ll come straight back to this invite.</p>
              </div>
            )}
            {invite.expires_at && <p className="mt-5 text-xs text-gray-400">This link expires on {formatExpiry(invite.expires_at)}</p>}
          </>
        )}
      </div>
    </div>
  )
}
