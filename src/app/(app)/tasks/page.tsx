import { sectionGuard } from '@/lib/section-guard'
import { getCachedTaskData, getCachedAllProfiles, getCachedUser, getCachedProfileAvatars, getCachedPersonalTasks } from '@/lib/data'
import { addDays, format } from 'date-fns'
import { PageHeader } from '@/components/ui/PageHeader'
import { ScopeToggle } from '@/components/layout/ScopeToggle'
import { PersonalTasks } from '@/components/tasks/PersonalTasks'
import { getWorkspaceContext } from '@/lib/workspace'
import { todayISO } from '@/lib/shows'
import { buildPeople } from '@/lib/tasks'
import { TasksView } from '@/components/tasks/list/TasksView'

interface Props {
  searchParams: Promise<{ view?: string; group?: string; task?: string; mine?: string; scope?: string }>
}

/** Tasks: one list across every group (edit right in it), or one group's Kanban. */
export default async function TasksPage({ searchParams }: Props) {
  const denied = await sectionGuard('tasks')
  if (denied) return denied
  const { view, group, task, mine, scope } = await searchParams
  // Your Personal space opens on your tasks from every workspace, unless you pick "This one".
  const wsCtx = await getWorkspaceContext()
  const canScope = wsCtx?.current.workspace.type === 'personal' && wsCtx.memberships.length > 1
  // Any List/Kanban link counts as "This one", so switching views doesn't jump back to All.
  const thisOne = scope === 'this' || !!view || !!group || !!mine || !!task
  if (wsCtx && canScope && !thisOne) {
    const today = todayISO()
    return (
      <div className="max-w-3xl">
        <PageHeader title="Tasks" subtitle="Assigned to you, across all your workspaces" action={<ScopeToggle all thisHref="/tasks?scope=this" allHref="/tasks" />} />
        <PersonalTasks tasks={await getCachedPersonalTasks()} currentId={wsCtx.current.workspace.id} today={today} weekAhead={format(addDays(new Date(today + 'T00:00:00'), 7), 'yyyy-MM-dd')} />
      </div>
    )
  }
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
      scopeToggle={canScope ? <ScopeToggle all={false} thisHref="/tasks?scope=this" allHref="/tasks" /> : undefined}
    />
  )
}
