import Link from 'next/link'
import { Lock } from 'lucide-react'

/** Shown instead of a section the signed-in member isn't allowed to open in this workspace. */
export function NoAccess({ section, workspaceName }: { section: string; workspaceName: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-gray-500">
        <Lock className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-gray-900">You don&apos;t have access to {section}</h1>
        <p className="max-w-sm text-sm text-gray-500">
          Your access to {section} in {workspaceName} has been turned off. Ask an admin if you need it.
        </p>
      </div>
      <Link href="/" className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white hover:bg-brand-500">
        Back to Today
      </Link>
    </div>
  )
}
