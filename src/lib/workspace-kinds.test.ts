import { describe, it, expect } from 'vitest'
import { extractInviteToken } from '@/components/workspace/constants'

describe('extractInviteToken', () => {
  it('takes the token from a full invite link', () => {
    expect(extractInviteToken('https://app.example.com/invite/abc123XYZ_-9?x=1')).toBe('abc123XYZ_-9')
  })
  it('accepts a bare token', () => {
    expect(extractInviteToken('  abc123XYZ789  ')).toBe('abc123XYZ789')
  })
  it('rejects empty or too-short input', () => {
    expect(extractInviteToken('')).toBeNull()
    expect(extractInviteToken('hello')).toBeNull()
    expect(extractInviteToken('https://example.com/setlists')).toBeNull()
  })
})
