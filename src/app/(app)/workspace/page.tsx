import { redirect } from 'next/navigation'

// Workspace settings now live inside Settings. Old links (and ?tab=…) land on the matching page.
const TAB_TO_PAGE: Record<string, string> = {
  general: '/settings/workspace',
  members: '/settings/members',
  invites: '/settings/invites',
  money: '/settings/money',
  danger: '/settings/leave',
}

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  redirect(TAB_TO_PAGE[tab ?? ''] ?? '/settings/workspace')
}
