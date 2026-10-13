/** The six muted colours a workspace can use for its avatar tile. Values live in globals.css as --ws-<tone>. */
export const WORKSPACE_TONE_IDS = ['forest', 'plum', 'ink', 'ocean', 'amber', 'rose'] as const
export type WorkspaceTone = (typeof WORKSPACE_TONE_IDS)[number]

export const DEFAULT_WORKSPACE_TONE: WorkspaceTone = 'forest'

export const WORKSPACE_TONES: Record<WorkspaceTone, { label: string; tile: string }> = {
  forest: { label: 'Forest', tile: 'bg-[var(--ws-forest)] text-[var(--ws-fg)]' },
  plum: { label: 'Plum', tile: 'bg-[var(--ws-plum)] text-[var(--ws-fg)]' },
  ink: { label: 'Ink', tile: 'bg-[var(--ws-ink)] text-[var(--ws-fg)]' },
  ocean: { label: 'Ocean', tile: 'bg-[var(--ws-ocean)] text-[var(--ws-fg)]' },
  amber: { label: 'Amber', tile: 'bg-[var(--ws-amber)] text-[var(--ws-fg)]' },
  rose: { label: 'Rose', tile: 'bg-[var(--ws-rose)] text-[var(--ws-fg)]' },
}

export function isWorkspaceTone(value: unknown): value is WorkspaceTone {
  return typeof value === 'string' && (WORKSPACE_TONE_IDS as readonly string[]).includes(value)
}

/** Any stored value becomes a known tone; unknown or missing falls back to forest. */
export function normaliseTone(value: string | null | undefined): WorkspaceTone {
  return isWorkspaceTone(value) ? value : DEFAULT_WORKSPACE_TONE
}

/** The single letter shown on a tile with no photo. */
export function workspaceInitial(name: string | null | undefined): string {
  const first = (name ?? '').trim().charAt(0)
  return first ? first.toUpperCase() : '?'
}
