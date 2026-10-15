import { NoAccess } from '@/components/layout/NoAccess'
import { getWorkspaceContext } from '@/lib/workspace'
import { sectionLabelOf, type SectionKey } from '@/lib/workspace-sections'

/**
 * Checked on the server for every request to a section page. Returns the no-access screen when the
 * signed-in member's access to that section is off in the current workspace, otherwise null.
 */
export async function sectionGuard(key: SectionKey) {
  const ctx = await getWorkspaceContext()
  if (!ctx || ctx.current.sections[key] !== 'none') return null
  return <NoAccess section={sectionLabelOf(key)} workspaceName={ctx.current.workspace.name} />
}
