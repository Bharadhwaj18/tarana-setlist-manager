import Link from 'next/link'
import { sectionGuard } from '@/lib/section-guard'
import { getCachedTaskData, getCachedAllProfiles, getCachedUser } from '@/lib/data'
import { todayISO } from '@/lib/shows'
import { buildPeople, byPosition } from '@/lib/tasks'
import { BoardsGrid, NewBoardForm, type BoardSummary } from '@/components/tasks/BoardsGrid'
import { TasksList } from '@/components/tasks/TasksList'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'

interface Props {
  searchParams: Promise<{ view?: string }>
}

export default async function TasksPage({ searchParams }: Props) {
  const denied = await sectionGuard('tasks')
  if (denied) return denied
  const { view } = await searchParams
  const tab = view === 'boards' ? 'boards' : 'list'
  const [data, profiles, { data: { user } }] = await Promise.all([getCachedTaskData(), getCachedAllProfiles(), getCachedUser()])
  const today = todayISO()
  const { members, nameById } = buildPeople(profiles, user?.id)

  const summaries: BoardSummary[] = data.boards.map(b => {
    const tasks = data.tasks.filter(t => t.board_id === b.id)
    const open = tasks.filter(t => t.progress !== 'completed')
    return {
      id: b.id,
      name: b.name,
      open: open.length,
      done: tasks.length - open.length,
      overdue: open.filter(t => t.due_date && t.due_date < today).length,
      bucketNames: data.buckets.filter(k => k.board_id === b.id).sort(byPosition).map(k => k.name),
    }
  })

  const openCount = data.tasks.filter(t => t.progress !== 'completed').length
  const tabs = [
    { key: 'list', label: 'List', href: '/tasks' },
    { key: 'boards', label: 'Kanban', href: '/tasks?view=boards' },
  ]

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Tasks"
        subtitle={tab === 'list'
          ? `${openCount} open across ${data.boards.length} group${data.boards.length === 1 ? '' : 's'}`
          : `${data.boards.length} board${data.boards.length === 1 ? '' : 's'}, one per group`}
        action={tab === 'boards' && data.boards.length > 0 ? <NewBoardForm /> : undefined}
      />

      <div className="mb-5 inline-flex rounded-xl bg-brand-100 p-1" role="tablist" aria-label="View">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={t.href}
            role="tab"
            aria-selected={tab === t.key}
            className={cn('rounded-lg px-4 py-2 text-sm font-bold transition-colors', tab === t.key ? 'bg-brand-400 text-white shadow-sm' : 'text-gray-700 hover:text-gray-900')}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'list' ? (
        <TasksList
          boards={data.boards}
          buckets={data.buckets}
          tasks={data.tasks}
          members={members}
          nameById={nameById}
          today={today}
          currentUserId={user?.id}
          initialMine={view === 'mine'}
        />
      ) : (
        <BoardsGrid boards={summaries} />
      )}
    </div>
  )
}
