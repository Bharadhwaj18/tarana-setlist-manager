import { redirect } from 'next/navigation'
import { getSettingsContext, getSettingsMembers } from '@/lib/settings-data'
import { SettingsHeader } from '@/components/settings/SettingsHeader'
import { DangerSettings } from '@/components/workspace/DangerSettings'

export default async function LeavePage() {
  const s = await getSettingsContext()
  if (s.isPersonal) redirect('/settings')
  const members = await getSettingsMembers()
  return (
    <>
      <SettingsHeader eyebrow={s.workspace.name} title={s.isAdmin ? 'Leave or delete' : `Leave ${s.workspace.name}`} />
      <div className="max-w-2xl"><DangerSettings workspaceName={s.workspace.name} members={members} isAdmin={s.isAdmin} isOwner={s.isOwner} /></div>
    </>
  )
}
