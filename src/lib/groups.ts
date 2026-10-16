// Workspace groups: owners and admins make their own (Vocals, Rhythm, Flute...) and put members in them.
// Each group sees either the song's chord chart, or notes written for that group on each song.

export type GroupSees = 'chart' | 'notes'

export interface WorkspaceGroup {
  id: string
  name: string
  color: string
  sees: GroupSees
  memberIds: string[]
}

/** A group's notes on one song. */
export interface GroupNote {
  content: string
  updatedBy: string | null
  updatedAt: string
}

export const GROUP_COLORS = ['#1F5A43', '#7A4F92', '#B8506F', '#2F7BA8', '#B8841F', '#4B5365'] as const

export const SEES_LABEL: Record<GroupSees, string> = { chart: 'Chord chart', notes: 'Notes' }
export const SEES_HINT: Record<GroupSees, string> = {
  chart: 'The song’s chords and lyrics, as written',
  notes: 'Notes written for this group, song by song',
}

export const MAX_GROUP_NAME = 40
export const MAX_GROUP_NOTES = 20000

export function seesFrom(value: string): GroupSees {
  return value === 'chart' ? 'chart' : 'notes'
}

export function isGroupColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value)
}
