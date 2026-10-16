import { describe, expect, it } from 'vitest'
import { cleanMoments, formatTime, parseReferenceLink, parseTime, titleFromAppleLink } from './song-references'

describe('parseReferenceLink', () => {
  it('reads Spotify track links in their usual shapes', () => {
    const id = '3BovdzfaX4jb5KFQwoPfAw'
    for (const link of [
      `https://open.spotify.com/track/${id}?si=abc123`,
      `open.spotify.com/intl-de/track/${id}`,
      `https://open.spotify.com/embed/track/${id}`,
      `spotify:track:${id}`,
    ]) {
      expect(parseReferenceLink(link)).toEqual({ source: 'spotify', externalId: id, url: `https://open.spotify.com/track/${id}` })
    }
  })

  it('reads YouTube watch, short, shorts and music links', () => {
    const id = 'oRdxUFDoQe0'
    for (const link of [
      `https://www.youtube.com/watch?v=${id}&t=42s`,
      `https://youtu.be/${id}?si=x`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://music.youtube.com/watch?v=${id}&list=RD`,
      `https://www.youtube.com/shorts/${id}`,
      `youtube.com/live/${id}`,
    ]) {
      expect(parseReferenceLink(link)).toEqual({ source: 'youtube', externalId: id, url: `https://www.youtube.com/watch?v=${id}` })
    }
  })

  it('keeps Apple Music and SoundCloud links as the link itself', () => {
    expect(parseReferenceLink('https://music.apple.com/in/album/thriller/269572838?i=269573364&l=en')).toEqual({
      source: 'apple', externalId: null, url: 'https://music.apple.com/in/album/thriller/269572838?i=269573364',
    })
    expect(parseReferenceLink('https://soundcloud.com/some-artist/some-track/')).toEqual({
      source: 'soundcloud', externalId: null, url: 'https://soundcloud.com/some-artist/some-track',
    })
  })

  it('turns down anything else', () => {
    for (const link of ['', 'not a link', 'https://example.com/song', 'https://open.spotify.com/album/3BovdzfaX4jb5KFQwoPfAw', 'https://youtube.com/watch?v=short']) {
      expect(parseReferenceLink(link)).toBeNull()
    }
  })
})

describe('times', () => {
  it('parses m:ss, h:mm:ss and plain seconds', () => {
    expect(parseTime('2:41')).toBe(161)
    expect(parseTime('1:02:05')).toBe(3725)
    expect(parseTime('95')).toBe(95)
    expect(parseTime(' 0:00 ')).toBe(0)
  })
  it('rejects things that are not times', () => {
    for (const t of ['', '2:61', 'a:10', '1:2:3:4', '2.5']) expect(parseTime(t)).toBeNull()
  })
  it('formats seconds back', () => {
    expect(formatTime(161)).toBe('2:41')
    expect(formatTime(3725)).toBe('1:02:05')
    expect(formatTime(0)).toBe('0:00')
  })
})

describe('cleanMoments', () => {
  it('drops bad entries, trims and sorts by time', () => {
    expect(cleanMoments([{ label: ' Solo ', at: 161.7 }, { label: 'Intro', at: 0 }, { label: '', at: 5 }, { at: 3 }, 'x', { label: 'Bad', at: Number.NaN }]))
      .toEqual([{ label: 'Intro', at: 0 }, { label: 'Solo', at: 161 }])
  })
  it('handles non-arrays', () => {
    expect(cleanMoments(null)).toEqual([])
  })
})

describe('titleFromAppleLink', () => {
  it('turns the slug into a title', () => {
    expect(titleFromAppleLink('https://music.apple.com/in/song/beat-it/269573364')).toBe('Beat It')
    expect(titleFromAppleLink('https://music.apple.com/in')).toBeNull()
  })
})

describe('isoDurationMs (YouTube durations)', () => {
  it('reads hours, minutes and seconds', async () => {
    const { isoDurationMs } = await import('./reference-lookup')
    expect(isoDurationMs('PT4M18S')).toBe(258000)
    expect(isoDurationMs('PT1H2M5S')).toBe(3725000)
    expect(isoDurationMs('PT45S')).toBe(45000)
    expect(isoDurationMs('P1D')).toBeNull()
  })
})
