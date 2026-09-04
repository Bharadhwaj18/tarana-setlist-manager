import { redirect } from 'next/navigation'
import { getCachedUser } from '@/lib/data'

export default async function RootPage() {
  const { data: { user } } = await getCachedUser()
  redirect(user ? '/setlists' : '/login')
}
