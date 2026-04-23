import type { Song } from 'chordsheetjs'

const CHROMATIC_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const normalize = (k: string) =>
  k.replace('Db', 'C#').replace('Eb', 'D#').replace('Fb', 'E')
   .replace('Gb', 'F#').replace('Ab', 'G#').replace('Bb', 'A#').replace('Cb', 'B')

export function transposeSong(song: Song, semitones: number): Song {
  return song.transpose(semitones)
}

export function transposeKey(key: string | null | undefined, semitones: number): string | null {
  if (!key) return null
  const isMinor = key.endsWith('m')
  const base = isMinor ? key.slice(0, -1) : key
  const idx = CHROMATIC_KEYS.indexOf(normalize(base))
  if (idx === -1) return key
  const newIdx = ((idx + semitones) % 12 + 12) % 12
  return CHROMATIC_KEYS[newIdx] + (isMinor ? 'm' : '')
}

export function getSemitoneDelta(fromKey: string, toKey: string): number {
  const from = CHROMATIC_KEYS.indexOf(normalize(fromKey).replace('m', ''))
  const to = CHROMATIC_KEYS.indexOf(normalize(toKey).replace('m', ''))
  if (from === -1 || to === -1) return 0
  return (to - from + 12) % 12
}
