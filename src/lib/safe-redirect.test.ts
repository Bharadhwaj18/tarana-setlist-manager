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
  it('keeps every link format notifications use', () => {
    const id = '1ebc818f-c1ea-438f-a49d-10b769c95582'
    for (const link of ['/', '/calendar', '/finance/history', `/shows/${id}`, `/setlists/${id}`, `/tasks?task=${id}`]) {
      expect(safeNextPath(link, '')).toBe(link)
    }
    expect(safeNextPath('javascript:alert(1)', '')).toBe('')
  })
  it('uses a custom fallback', () => {
    expect(safeNextPath('nope', '/x')).toBe('/x')
  })
})
