import { describe, it, expect } from 'vitest'
import { pickSupportedMimeType, extensionForMimeType, formatDuration } from './audio-recorder'

describe('pickSupportedMimeType', () => {
  it('prefers webm/opus when the browser supports it (Chrome/Android/desktop)', () => {
    const isSupported = (type: string) => type === 'audio/webm;codecs=opus' || type === 'audio/webm'
    expect(pickSupportedMimeType(isSupported)).toBe('audio/webm;codecs=opus')
  })

  it('falls back to mp4 when webm is unsupported (Safari)', () => {
    const isSupported = (type: string) => type === 'audio/mp4'
    expect(pickSupportedMimeType(isSupported)).toBe('audio/mp4')
  })

  it('returns null when nothing in the candidate list is supported', () => {
    expect(pickSupportedMimeType(() => false)).toBeNull()
  })
})

describe('extensionForMimeType', () => {
  it('maps mp4/aac to m4a', () => {
    expect(extensionForMimeType('audio/mp4')).toBe('m4a')
    expect(extensionForMimeType('audio/aac')).toBe('m4a')
  })

  it('maps everything else (webm) to webm', () => {
    expect(extensionForMimeType('audio/webm;codecs=opus')).toBe('webm')
    expect(extensionForMimeType('audio/webm')).toBe('webm')
  })
})

describe('formatDuration', () => {
  it('formats seconds as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(42)).toBe('0:42')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(600)).toBe('10:00')
  })

  it('rounds fractional seconds and clamps negative input to 0', () => {
    expect(formatDuration(41.6)).toBe('0:42')
    expect(formatDuration(-5)).toBe('0:00')
  })
})
