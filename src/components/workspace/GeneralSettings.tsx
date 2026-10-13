'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { updateWorkspaceDetails } from '@/actions/workspace'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Chip } from '@/components/ui/Chip'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toaster'
import { WorkspaceAvatar } from '@/components/ui/WorkspaceAvatar'
import { normaliseTone, type WorkspaceTone } from '@/lib/workspace-tones'
import { WORKSPACE_KINDS } from './constants'
import { ToneSwatches } from './ToneSwatches'
import { AvatarEditor } from './AvatarEditor'
import type { WorkspaceSummary } from './settings-types'

const label = 'mb-1.5 block text-sm font-bold text-gray-800'

export function GeneralSettings({ workspace, canEdit }: { workspace: WorkspaceSummary; canEdit: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [name, setName] = useState(workspace.name)
  const [kind, setKind] = useState(workspace.kind ?? '')
  const [description, setDescription] = useState(workspace.description ?? '')
  const [tone, setTone] = useState<WorkspaceTone>(normaliseTone(workspace.color))
  const [editorOpen, setEditorOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const dirty =
    name.trim() !== workspace.name ||
    kind.trim() !== (workspace.kind ?? '') ||
    description.trim() !== (workspace.description ?? '') ||
    tone !== normaliseTone(workspace.color)

  const save = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await updateWorkspaceDetails({ name, kind, description, color: tone })
      if (res.error) { setError(res.error); return }
      toast('Saved', 'success')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <WorkspaceAvatar name={name || workspace.name} color={tone} avatarUrl={workspace.avatarUrl} size="xl" />
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl font-bold text-gray-900">{workspace.name}</h2>
          {canEdit && (
            <button type="button" onClick={() => setEditorOpen(true)} className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 hover:underline">
              <Pencil className="h-3.5 w-3.5" /> Change logo or photo
            </button>
          )}
        </div>
      </div>

      <form onSubmit={save} className="space-y-5 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
        <div>
          <label htmlFor="ws-name" className={label}>Name</label>
          <Input id="ws-name" value={name} maxLength={60} disabled={!canEdit} onChange={e => setName(e.target.value)} />
        </div>

        <div>
          <p className={label}>What is it for?</p>
          <div className="flex flex-wrap gap-2">
            {WORKSPACE_KINDS.map(k => (
              <Chip key={k} active={kind === k} disabled={!canEdit} onClick={() => setKind(kind === k ? '' : k)}>{k}</Chip>
            ))}
            {kind && !(WORKSPACE_KINDS as readonly string[]).includes(kind) && <Chip active disabled>{kind}</Chip>}
          </div>
        </div>

        <div>
          <label htmlFor="ws-description" className={label}>Description</label>
          <Textarea id="ws-description" rows={3} maxLength={300} disabled={!canEdit} placeholder="A line about this workspace (optional)" value={description} onChange={e => setDescription(e.target.value)} />
          <p className="mt-1 text-right text-[11px] text-gray-400">{description.length}/300</p>
        </div>

        <div>
          <p className={label}>Colour</p>
          <ToneSwatches value={tone} onChange={setTone} disabled={!canEdit} />
          {workspace.avatarUrl && <p className="mt-2 text-xs text-gray-500">Used when there’s no photo. The photo is showing now.</p>}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {canEdit ? (
          <div className="flex gap-2">
            <Button type="submit" loading={pending} disabled={!dirty || !name.trim()}>Save changes</Button>
            {dirty && <Button type="button" variant="secondary" disabled={pending} onClick={() => { setName(workspace.name); setKind(workspace.kind ?? ''); setDescription(workspace.description ?? ''); setTone(normaliseTone(workspace.color)) }}>Discard</Button>}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Only a workspace admin can change these.</p>
        )}
      </form>

      {canEdit && (
        <AvatarEditor workspaceId={workspace.id} name={workspace.name} color={workspace.color} avatarUrl={workspace.avatarUrl} open={editorOpen} onOpenChange={setEditorOpen} />
      )}
    </div>
  )
}
