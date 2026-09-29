import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser } from '@/lib/auth-cache'
import { Button } from '@/components/ui/Button'
import { AcceptInviteButton } from '@/components/workspace/AcceptInviteButton'

const STATE_MESSAGES: Record<string, string> = {
  revoked: 'This invite link was cancelled. Ask whoever invited you for a new one.',
  expired: 'This invite link has expired. Ask whoever invited you for a new one.',
  used_up: 'This invite link has already been used the maximum number of times. Ask for a new one.',
  unavailable: 'This workspace isn’t accepting new members right now.',
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc('invite_preview', { p_token: token })
  const invite = data?.[0]
  const { data: { user } } = await getCachedUser()

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Image src="/logo.png" alt="Tarana" width={64} height={64} className="rounded-2xl object-contain shadow-lg" />
      </div>

      <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
        {!invite ? (
          <>
            <h1 className="text-lg font-semibold text-gray-900">Invite link not found</h1>
            <p className="mt-2 text-sm text-gray-500">Check that you copied the whole link, or ask whoever invited you to send it again.</p>
          </>
        ) : invite.state !== 'valid' ? (
          <>
            <h1 className="text-lg font-semibold text-gray-900">{invite.workspace_name}</h1>
            <p className="mt-2 text-sm text-gray-500">{STATE_MESSAGES[invite.state] ?? 'This invite link can’t be used.'}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500">You’ve been invited to join</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">{invite.workspace_name}</h1>
            {user ? (
              <div className="mt-6">
                <AcceptInviteButton token={token} />
                <p className="mt-3 text-xs text-gray-400">Signed in as {user.email}</p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <Button asChild className="w-full">
                  <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>Sign in to join</Link>
                </Button>
                <p className="text-xs text-gray-400">New here? Choose “Magic Link” on the next screen and we’ll email you a sign-in link.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
