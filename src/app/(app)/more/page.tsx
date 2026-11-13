import { getCachedUser } from '@/lib/data'
import { getWorkspaceOptions } from '@/lib/workspace-options-server'
import { PageHeader } from '@/components/ui/PageHeader'
import { MoreMenu } from '@/components/layout/MoreMenu'
import { getWorkspaceContext, navHiddenSections } from '@/lib/workspace'

export default async function MorePage() {
  const [{ data: { user } }, { options, currentId }, ctx] = await Promise.all([getCachedUser(), getWorkspaceOptions(), getWorkspaceContext()])

  return (
    <div className="max-w-xl">
      <PageHeader title="More" />
      <MoreMenu
        email={user?.email ?? ''}
        workspaces={options}
        currentWorkspaceId={currentId}
        hiddenSections={ctx ? navHiddenSections(ctx.current) : []}
      />
    </div>
  )
}
