import Link from 'next/link'
import { EmptyState } from '@/components/ui/EmptyState'

/** Shown on a Finance tool's page when an admin has turned that tool off in Money settings. */
export function FeatureOff({ title, isAdmin }: { title: string; isAdmin: boolean }) {
  return (
    <EmptyState
      title={`${title} is turned off`}
      description={isAdmin ? 'Turn it on under Extra tools in Money settings.' : 'Ask a workspace admin to turn it on in Money settings.'}
      action={isAdmin ? <Link href="/settings/money" className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500">Open Money settings</Link> : undefined}
    />
  )
}
