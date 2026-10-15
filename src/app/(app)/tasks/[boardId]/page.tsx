import { notFound } from 'next/navigation'
import { sectionGuard } from '@/lib/section-guard'
import { getCachedTaskData, getCachedAllProfiles, getCachedUser } from '@/lib/data'
import { buildPeople } from '@/lib/tasks'
import { todayISO } from '@/lib/shows'
import { BoardView } from '@/components/tasks/BoardView'

interface Props {
  params: Promise<{ boardId: string }>
  searchParams: Promise<{ task?: string }>
}

export default async function BoardPage({ params, searchParams }: Props) {
  const denied = await sectionGuard('tasks')
  if (denied) return denied
  const [{ boardId }, { task }] = await Promise.all([params, searchParams])
  const [all, profiles, { data: { user } }] = await Promise.all([getCachedTaskData(), getCachedAllProfiles(), getCachedUser()])

  const board = all.boards.find(b => b.id === boardId)
  if (!board) notFound()

  const data = {
    boards: [board],
    buckets: all.buckets.filter(b => b.board_id === boardId),
    tasks: all.tasks.filter(t => t.board_id === boardId),
  }
  const { members, nameById } = buildPeople(profiles, user?.id)

  return (
    <BoardView
      key={`${boardId}:${task ?? ''}`}
      board={board}
      data={data}
      members={members}
      nameById={nameById}
      today={todayISO()}
      currentUserId={user?.id}
      initialTaskId={task}
    />
  )
}
