'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, FileText, ListMusic, Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/utils'
import { createGroup, deleteGroup, setMemberGroups, updateGroup } from '@/actions/groups'
import { GROUP_COLORS, MAX_GROUP_NAME, SEES_HINT, SEES_LABEL, type GroupSees, type WorkspaceGroup } from '@/lib/groups'

export interface GroupPerson {
  userId: string
  name: string
  avatarUrl?: string | null
}

/** A group's colour dot and name, as a small tag. */
export function GroupTag({ group, className }: { group: Pick<WorkspaceGroup, 'name' | 'color'>; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-extrabold text-gray-800', className)}>
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: group.color }} />
      {group.name}
    </span>
  )
}

const SeesIcon = ({ sees, className }: { sees: GroupSees; className?: string }) =>
  sees === 'chart' ? <ListMusic className={className} /> : <FileText className={className} />

/** The workspace's groups, as cards above the member list. Admins create and edit them here. */
export function GroupsSection({ groups, people, isAdmin }: { groups: WorkspaceGroup[]; people: GroupPerson[]; isAdmin: boolean }) {
  const [sheet, setSheet] = useState<{ group: WorkspaceGroup | null } | null>(null)

  if (!groups.length && !isAdmin) return null

  return (
    <section aria-labelledby="groups-heading" className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 id="groups-heading" className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-500">Groups{groups.length > 0 && ` · ${groups.length}`}</h2>
        {isAdmin && groups.length > 0 && (
          <button type="button" onClick={() => setSheet({ group: null })} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-extrabold text-brand-700 hover:bg-brand-50">
            <Plus className="h-4 w-4" />New group
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-brand-200 p-4 text-center">
          <p className="text-sm text-gray-600">Make groups like Vocals, Rhythm or Flute. Each group gets its own view of every song.</p>
          <button type="button" onClick={() => setSheet({ group: null })}
            className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-extrabold text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" />Make a group
          </button>
        </div>
      ) : (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
          {groups.map(g => {
            const members = people.filter(p => g.memberIds.includes(p.userId))
            const cardClass = cn('flex w-40 shrink-0 flex-col gap-2 rounded-2xl border border-brand-200 bg-white p-3 text-left sm:w-auto', isAdmin && 'transition-colors hover:border-brand-300')
            const body = (
              <>
                <span className="flex items-center gap-2 font-extrabold text-gray-900">
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: g.color }} />
                  <span className="truncate">{g.name}</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500"><SeesIcon sees={g.sees} className="h-3.5 w-3.5" />{SEES_LABEL[g.sees]}</span>
                <span className="flex items-center">
                  {members.slice(0, 5).map((p, i) => (
                    <span key={p.userId} className={cn('rounded-full ring-2 ring-white', i > 0 && '-ml-2')}><UserAvatar name={p.name} id={p.userId} avatarUrl={p.avatarUrl} size={24} /></span>
                  ))}
                  <span className="ml-2 text-xs font-bold text-gray-400">{members.length ? members.length : 'No one yet'}</span>
                </span>
              </>
            )
            return isAdmin
              ? <button key={g.id} type="button" onClick={() => setSheet({ group: g })} aria-label={`Edit the ${g.name} group`} className={cardClass}>{body}</button>
              : <div key={g.id} className={cardClass}>{body}</div>
          })}
        </div>
      )}

      {groups.length > 0 && <p className="px-1 text-xs text-gray-500">Each group decides what its members see in every song.</p>}

      <GroupSheet open={!!sheet} group={sheet?.group ?? null} people={people} onOpenChange={o => { if (!o) setSheet(null) }} />
    </section>
  )
}

/** Make or edit a group: its name, colour, what it sees in songs, and who's in it. */
export function GroupSheet({ open, group, people, presetMemberId, onOpenChange }: {
  open: boolean
  group: WorkspaceGroup | null
  people: GroupPerson[]
  /** Starts with this person ticked (making a group from a member's sheet). */
  presetMemberId?: string
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={group ? 'Edit group' : 'New group'} className="max-w-[460px] rounded-2xl">
      {open && <GroupForm group={group} people={people} presetMemberId={presetMemberId} onDone={() => onOpenChange(false)} />}
    </Modal>
  )
}

function GroupForm({ group, people, presetMemberId, onDone }: { group: WorkspaceGroup | null; people: GroupPerson[]; presetMemberId?: string; onDone: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const [name, setName] = useState(group?.name ?? '')
  const [color, setColor] = useState<string>(group?.color ?? GROUP_COLORS[0])
  const [sees, setSees] = useState<GroupSees>(group?.sees ?? 'notes')
  const [memberIds, setMemberIds] = useState<string[]>(group?.memberIds ?? (presetMemberId ? [presetMemberId] : []))
  const [pending, startTransition] = useTransition()

  const toggle = (id: string) => setMemberIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]))

  const save = () => {
    if (!name.trim()) { toast('Give the group a name, like Vocals or Rhythm.', 'error'); return }
    startTransition(async () => {
      const input = { name, color, sees, memberIds }
      const res = group ? await updateGroup(group.id, input) : await createGroup(input)
      if (res.error) { toast(res.error, 'error'); return }
      toast(group ? 'Group saved' : 'Group created', 'success')
      router.refresh()
      onDone()
    })
  }

  const remove = () => {
    if (!group || !window.confirm(`Delete the “${group.name}” group? Its notes on every song go too.`)) return
    startTransition(async () => {
      const res = await deleteGroup(group.id)
      if (res.error) { toast(res.error, 'error'); return }
      toast('Group deleted', 'success')
      router.refresh()
      onDone()
    })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="group-name" className="text-xs font-extrabold text-gray-500">Name</label>
        <input id="group-name" autoFocus={!group} value={name} maxLength={MAX_GROUP_NAME} onChange={e => setName(e.target.value)} placeholder="Vocals, Rhythm, Flute…"
          className="min-h-12 w-full rounded-xl border border-brand-200 bg-white px-3 text-[15px] font-bold text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30" />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-extrabold text-gray-500">Colour</p>
        <div role="radiogroup" aria-label="Colour" className="flex gap-2.5">
          {GROUP_COLORS.map(c => (
            <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)}
              className="h-9 w-9 rounded-xl"
              style={{ background: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 3 }} />
          ))}
        </div>
      </div>

      <div role="radiogroup" aria-label="What they see in every song" className="space-y-2">
        <p className="text-xs font-extrabold text-gray-500">What they see in every song</p>
        {(['chart', 'notes'] as const).map(s => (
          <button key={s} type="button" role="radio" aria-checked={sees === s} onClick={() => setSees(s)}
            className={cn('flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-[1.5px] px-3 text-left', sees === s ? 'border-brand-600 bg-brand-50' : 'border-brand-200 bg-white hover:bg-brand-50/50')}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><SeesIcon sees={s} className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold text-gray-900">{SEES_LABEL[s]}</span>
              <span className="block text-xs text-gray-500">{SEES_HINT[s]}</span>
            </span>
            <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', sees === s ? 'border-brand-600' : 'border-gray-300')}>
              {sees === s && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-extrabold text-gray-500">Who’s in it</p>
        <div className="max-h-56 overflow-y-auto">
          {people.map(p => {
            const on = memberIds.includes(p.userId)
            return (
              <button key={p.userId} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(p.userId)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-1 text-left hover:bg-brand-50">
                <UserAvatar name={p.name} id={p.userId} avatarUrl={p.avatarUrl} size={30} />
                <span className="flex-1 truncate font-bold text-gray-900">{p.name}</span>
                <span className={cn('flex h-6 w-6 items-center justify-center rounded-md border-2', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300')}>
                  {on && <Check className="h-4 w-4" />}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        {group && (
          <button type="button" onClick={remove} disabled={pending} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
            <Trash2 className="h-4 w-4" />Delete
          </button>
        )}
        <span className="flex-1" />
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="button" onClick={save} loading={pending}>{group ? 'Save' : 'Create group'}</Button>
      </div>
    </div>
  )
}

/** Tick which groups one member is in, or make a new group with them in it. */
export function MemberGroupsSheet({ person, groups, people, open, onOpenChange }: {
  person: GroupPerson
  groups: WorkspaceGroup[]
  people: GroupPerson[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [making, setMaking] = useState(false)
  return (
    <>
      <Modal open={open && !making} onOpenChange={onOpenChange} title={`${person.name}’s groups`} className="max-w-[440px] rounded-2xl">
        {open && !making && <MemberGroupsForm person={person} groups={groups} onMake={() => setMaking(true)} onDone={() => onOpenChange(false)} />}
      </Modal>
      <GroupSheet open={making} group={null} people={people} presetMemberId={person.userId} onOpenChange={o => { if (!o) { setMaking(false); onOpenChange(false) } }} />
    </>
  )
}

function MemberGroupsForm({ person, groups, onMake, onDone }: { person: GroupPerson; groups: WorkspaceGroup[]; onMake: () => void; onDone: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const [ids, setIds] = useState<string[]>(groups.filter(g => g.memberIds.includes(person.userId)).map(g => g.id))
  const [pending, startTransition] = useTransition()
  const toggle = (id: string) => setIds(list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]))

  const save = () => startTransition(async () => {
    const res = await setMemberGroups(person.userId, ids)
    if (res.error) { toast(res.error, 'error'); return }
    toast('Groups saved', 'success')
    router.refresh()
    onDone()
  })

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-brand-200">
        {groups.map(g => {
          const on = ids.includes(g.id)
          return (
            <button key={g.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(g.id)}
              className="flex min-h-14 w-full items-center gap-3 border-b border-brand-100 px-3 text-left hover:bg-brand-50">
              <span aria-hidden className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: g.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold text-gray-900">{g.name}</span>
                <span className="block text-xs text-gray-500">Sees: {SEES_LABEL[g.sees].toLowerCase()}</span>
              </span>
              <span className={cn('flex h-6 w-6 items-center justify-center rounded-md border-2', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300')}>
                {on && <Check className="h-4 w-4" />}
              </span>
            </button>
          )
        })}
        <button type="button" onClick={onMake} className="flex min-h-12 w-full items-center gap-2 px-3 text-sm font-extrabold text-brand-700 hover:bg-brand-50">
          <Plus className="h-4 w-4" />Make a new group
        </button>
      </div>
      <p className="text-xs text-gray-500">In more than one group? They can switch between views on any song.</p>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="button" onClick={save} loading={pending}>Save</Button>
      </div>
    </div>
  )
}
