import { getCachedUser } from '@/lib/data'
import { getWorkspaceOptions } from '@/lib/workspace-options-server'
import { PageHeader } from '@/components/ui/PageHeader'
import { MoreMenu } from '@/components/layout/MoreMenu'
import { getWorkspaceContext } from '@/lib/workspace'
import { hiddenSectionsOf } from '@/lib/workspace-sections'

export default async function MorePage() {
  const [{ data: { user } }, { options, currentId }, ctx] = await Promise.all([getCachedUser(), getWorkspaceOptions(), getWorkspaceContext()])

  return (
    <div className="max-w-xl">
      <PageHeader title="More" />
      <MoreMenu
        email={user?.email ?? ''}
        workspaces={options}
        currentWorkspaceId={currentId}
        hiddenSections={ctx ? hiddenSectionsOf(ctx.current.sections) : []}
      />
    </div>
  )
}
