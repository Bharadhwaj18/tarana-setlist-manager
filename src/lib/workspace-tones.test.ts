import { describe, it, expect } from 'vitest'
import { normaliseTone, isWorkspaceTone, workspaceInitial, WORKSPACE_TONE_IDS, WORKSPACE_TONES } from './workspace-tones'

describe('workspace tones', () => {
  it('knows every tone and gives each a tile class', () => {
    for (const id of WORKSPACE_TONE_IDS) {
      expect(isWorkspaceTone(id)).toBe(true)
      expect(WORKSPACE_TONES[id].tile).toContain(`--ws-${id}`)
    }
  })

  it('falls back to forest for unknown, empty or missing values', () => {
    expect(normaliseTone('plum')).toBe('plum')
    expect(normaliseTone('hotpink')).toBe('forest')
    expect(normaliseTone('')).toBe('forest')
    expect(normaliseTone(null)).toBe('forest')
    expect(normaliseTone(undefined)).toBe('forest')
  })

  it('uses the first letter of the trimmed name, upper-cased', () => {
    expect(workspaceInitial('  tarana')).toBe('T')
    expect(workspaceInitial('Rooftop Collective')).toBe('R')
    expect(workspaceInitial('')).toBe('?')
    expect(workspaceInitial(null)).toBe('?')
  })
})
