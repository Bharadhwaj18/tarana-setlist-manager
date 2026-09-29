'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createWorkspace } from '@/actions/workspace'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function CreateWorkspaceForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await createWorkspace(name)
      if (res.error) {
        setError(res.error)
        return
      }
      router.push('/workspace')
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="workspace-name" className="mb-1.5 block text-sm font-medium text-gray-700">Workspace name</label>
        <Input id="workspace-name" autoFocus maxLength={60} placeholder="e.g. The Local Train, Studio 9, Sunday Jam" value={name} onChange={e => setName(e.target.value)} />
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      </div>
      <Button type="submit" loading={pending} disabled={!name.trim()}>Create workspace</Button>
    </form>
  )
}
