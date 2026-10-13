import { getCachedUser } from '@/lib/data'
import { getWorkspaceOptions } from '@/lib/workspace-options-server'
import { PageHeader } from '@/components/ui/PageHeader'
import { MoreMenu } from '@/components/layout/MoreMenu'

export default async function MorePage() {
  const [{ data: { user } }, { options, currentId }] = await Promise.all([getCachedUser(), getWorkspaceOptions()])

  return (
    <div className="max-w-xl">
      <PageHeader title="More" />
      <MoreMenu
        email={user?.email ?? ''}
        workspaces={options}
        currentWorkspaceId={currentId}
      />
    </div>
  )
}
