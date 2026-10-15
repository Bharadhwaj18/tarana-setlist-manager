import { sectionGuard } from '@/lib/section-guard'
import { getCachedTaskData, getCachedAllProfiles, getCachedUser, getCachedProfileAvatars } from '@/lib/data'
import { getWorkspaceContext } from '@/lib/workspace'
import { todayISO } from '@/lib/shows'
import { buildPeople } from '@/lib/tasks'
import { TasksView } from '@/components/tasks/list/TasksView'

interface Props {
  searchParams: Promise<{ view?: string; group?: string; task?: string; mine?: string }>
}

/** Tasks: one list across every group (edit right in it), or one group's Kanban. */
export default async function TasksPage({ searchParams }: Props) {
  const denied = await sectionGuard('tasks')
  if (denied) return denied
  const { view, group, task, mine } = await searchParams
  const [data, profiles, avatars, { data: { user } }, ctx] = await Promise.all([
    getCachedTaskData(), getCachedAllProfiles(), getCachedProfileAvatars(), getCachedUser(), getWorkspaceContext(),
  ])
  const { members, nameById } = buildPeople(profiles, user?.id)

  return (
    <TasksView
      key={view === 'kanban' ? `kanban:${group ?? ''}` : 'list'}
      boards={data.boards}
      buckets={data.buckets}
      tasks={data.tasks}
      fields={data.fields}
      members={members}
      nameById={nameById}
      avatars={avatars}
      today={todayISO()}
      currentUserId={user?.id}
      readOnly={ctx?.current.sections.tasks === 'view'}
      view={view === 'kanban' ? 'kanban' : 'list'}
      kanbanGroupId={group}
      openTaskId={task}
      onlyMine={mine === '1'}
    />
  )
}
