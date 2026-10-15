import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ boardId: string }>
  searchParams: Promise<{ task?: string }>
}

// Groups no longer have their own page. A link to one task opens it in the list; a link to a group opens its Kanban.
export default async function BoardPage({ params, searchParams }: Props) {
  const [{ boardId }, { task }] = await Promise.all([params, searchParams])
  redirect(task ? `/tasks?task=${encodeURIComponent(task)}` : `/tasks?view=kanban&group=${encodeURIComponent(boardId)}`)
}
