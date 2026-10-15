import type { ReactNode } from 'react'
import { getSettingsContext } from '@/lib/settings-data'
import { settingsItems } from '@/lib/settings-sections'
import { getWorkspaceOptions } from '@/lib/workspace-options-server'
import { SettingsNav } from '@/components/settings/SettingsNav'

/** Settings: your own things and the current workspace's, in one place. Desktop shows the menu on the left. */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const [s, { options, currentId }] = await Promise.all([getSettingsContext(), getWorkspaceOptions()])
  const items = settingsItems({ isPersonal: s.isPersonal, isAdmin: s.isAdmin, workspaceName: s.workspace.name })
  return (
    <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
      <aside className="hidden lg:block">
        <h1 className="mb-5 ml-3 font-display text-3xl font-bold text-gray-900">Settings</h1>
        <SettingsNav items={items} workspaces={options} currentId={currentId} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
