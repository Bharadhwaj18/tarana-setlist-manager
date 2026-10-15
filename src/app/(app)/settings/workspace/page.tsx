import { redirect } from 'next/navigation'
import { Lock } from 'lucide-react'
import { getSettingsContext, getSettingsMembers } from '@/lib/settings-data'
import { SettingsHeader } from '@/components/settings/SettingsHeader'
import { GeneralSettings } from '@/components/workspace/GeneralSettings'
import { WorkspaceAvatar } from '@/components/ui/WorkspaceAvatar'

export default async function WorkspaceGeneralPage() {
  const s = await getSettingsContext()
  if (s.isPersonal) redirect('/settings')

  if (s.isAdmin) {
    return (
      <>
        <SettingsHeader eyebrow={s.workspace.name} title="General" />
        <div className="max-w-2xl"><GeneralSettings workspace={s.workspace} canEdit /></div>
      </>
    )
  }

  // Members see the details as plain text.
  const owner = (await getSettingsMembers()).find(m => m.role === 'owner')?.name
  const rows: [string, string | null][] = [
    ['Name', s.workspace.name],
    ['What it’s for', s.workspace.kind],
    ['Description', s.workspace.description],
    ['Owner', owner ?? null],
  ]
  return (
    <>
      <SettingsHeader eyebrow={s.workspace.name} title="General" />
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-3">
          <WorkspaceAvatar name={s.workspace.name} color={s.workspace.color} avatarUrl={s.workspace.avatarUrl} size="lg" />
          <p className="font-display text-2xl font-bold text-gray-900">{s.workspace.name}</p>
        </div>
        <p className="flex items-center gap-2 rounded-xl bg-brand-100 px-4 py-3 text-sm font-bold text-gray-600"><Lock className="h-4 w-4" /> View only. Ask an admin to change these.</p>
        <dl className="overflow-hidden rounded-2xl border border-brand-200 bg-white">
          {rows.filter(([, v]) => v).map(([k, v], i, a) => (
            <div key={k} className={i < a.length - 1 ? 'border-b border-brand-100 px-4 py-3' : 'px-4 py-3'}>
              <dt className="text-xs font-extrabold text-gray-500">{k}</dt>
              <dd className="mt-0.5 text-[15px] leading-relaxed text-gray-900">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  )
}
