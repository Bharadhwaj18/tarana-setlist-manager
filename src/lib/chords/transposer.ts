import type { Song } from 'chordsheetjs'

export function transposeSong(song: Song, semitones: number): Song {
  return song.transpose(semitones)
}

const CHROMATIC_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function getSemitoneDelta(fromKey: string, toKey: string): number {
  const normalize = (k: string) => k.replace('Db', 'C#').replace('Eb', 'D#').replace('Fb', 'E').replace('Gb', 'F#').replace('Ab', 'G#').replace('Bb', 'A#').replace('Cb', 'B')
  const from = CHROMATIC_KEYS.indexOf(normalize(fromKey).replace('m', ''))
  const to = CHROMATIC_KEYS.indexOf(normalize(toKey).replace('m', ''))
  if (from === -1 || to === -1) return 0
  return (to - from + 12) % 12
}
