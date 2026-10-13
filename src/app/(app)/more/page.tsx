import { getCachedUser } from '@/lib/data'
import { getWorkspaceContext } from '@/lib/workspace'
import { PageHeader } from '@/components/ui/PageHeader'
import { MoreMenu } from '@/components/layout/MoreMenu'

export default async function MorePage() {
  const [{ data: { user } }, ctx] = await Promise.all([getCachedUser(), getWorkspaceContext()])

  return (
    <div className="max-w-xl">
      <PageHeader title="More" />
      <MoreMenu
        email={user?.email ?? ''}
        workspaces={ctx?.memberships.map(m => ({ id: m.workspace.id, name: m.workspace.name, type: m.workspace.type })) ?? []}
        currentWorkspaceId={ctx?.current.workspace.id ?? ''}
      />
    </div>
  )
}
