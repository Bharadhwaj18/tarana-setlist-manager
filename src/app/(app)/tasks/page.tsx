import Link from 'next/link'
import { getCachedTaskData, getCachedUser } from '@/lib/data'
import { todayISO } from '@/lib/shows'
import { addDaysISO } from '@/lib/dates'
import { byPosition, compareOpenTasks, myTaskGroup } from '@/lib/tasks'
import { BoardsGrid, NewBoardForm, type BoardSummary } from '@/components/tasks/BoardsGrid'
import { MyTasks, type MyTaskItem } from '@/components/tasks/MyTasks'
import { cn } from '@/lib/utils'

interface Props {
  searchParams: Promise<{ view?: string }>
}

export default async function TasksPage({ searchParams }: Props) {
  const { view } = await searchParams
  const tab = view === 'mine' ? 'mine' : 'boards'
  const [data, { data: { user } }] = await Promise.all([getCachedTaskData(), getCachedUser()])
  const today = todayISO()
  const weekAhead = addDaysISO(today, 7)

  const boardName = new Map(data.boards.map(b => [b.id, b.name]))
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

  const mine = data.tasks.filter(t => !!user && t.assignee_ids.includes(user.id) && boardName.has(t.board_id))
  const toItem = (t: (typeof mine)[number]): MyTaskItem => ({
    id: t.id,
    boardId: t.board_id,
    boardName: boardName.get(t.board_id)!,
    title: t.title,
    progress: t.progress,
    priority: t.priority,
    dueDate: t.due_date,
    group: myTaskGroup(t.due_date, today, weekAhead),
  })
  const open = mine.filter(t => t.progress !== 'completed').sort(compareOpenTasks).map(toItem)
  const completed = mine
    .filter(t => t.progress === 'completed')
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    .slice(0, 10)
    .map(toItem)
  const dueSoon = open.filter(i => i.group === 'overdue' || i.group === 'today').length

  const tabs = [
    { key: 'boards', label: 'Boards', href: '/tasks' },
    { key: 'mine', label: `My tasks${open.length ? ` (${open.length})` : ''}`, href: '/tasks?view=mine' },
  ]

  return (
    <div className="max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tab === 'boards'
              ? `${data.boards.length} board${data.boards.length === 1 ? '' : 's'} — shared by everyone in the workspace`
              : dueSoon ? `${dueSoon} overdue or due today` : 'Everything assigned to you, across all boards'}
          </p>
        </div>
        {tab === 'boards' && data.boards.length > 0 && <NewBoardForm />}
      </div>

      <div className="mb-6 flex gap-1 border-b border-gray-200" role="tablist">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={t.href}
            role="tab"
            aria-selected={tab === t.key}
            className={cn('-mb-px border-b-2 px-4 py-2 text-sm font-medium', tab === t.key ? 'border-brand-500 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700')}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'boards' ? <BoardsGrid boards={summaries} /> : <MyTasks open={open} completed={completed} today={today} />}
    </div>
  )
}
