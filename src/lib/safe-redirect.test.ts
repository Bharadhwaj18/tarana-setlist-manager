import { describe, it, expect } from 'vitest'
import { safeNextPath } from './safe-redirect'

describe('safeNextPath', () => {
  it('keeps same-site paths, including query strings', () => {
    expect(safeNextPath('/invite/abc123')).toBe('/invite/abc123')
    expect(safeNextPath('/songs?q=x')).toBe('/songs?q=x')
  })
  it('falls back for missing or off-site values', () => {
    expect(safeNextPath(null)).toBe('/')
    expect(safeNextPath('')).toBe('/')
    expect(safeNextPath('https://evil.com')).toBe('/')
    expect(safeNextPath('//evil.com')).toBe('/')
    expect(safeNextPath('@evil.com')).toBe('/')
    expect(safeNextPath('/\\evil.com')).toBe('/')
    expect(safeNextPath('/a\nb')).toBe('/')
  })
  it('uses a custom fallback', () => {
    expect(safeNextPath('nope', '/x')).toBe('/x')
  })
})
