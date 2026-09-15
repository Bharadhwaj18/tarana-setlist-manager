import { describe, it, expect } from 'vitest'
import { urlBase64ToUint8Array } from './push-client'

describe('urlBase64ToUint8Array', () => {
  it('decodes a plain base64 string to the right bytes', () => {
    // "hello" in base64
    expect(Array.from(urlBase64ToUint8Array('aGVsbG8='))).toEqual([104, 101, 108, 108, 111])
  })

  it('handles URL-safe characters (- and _) the same as + and /', () => {
    // "\xfb\xff" base64-encoded is "+/8=" standard, "-_8=" URL-safe
    expect(Array.from(urlBase64ToUint8Array('-_8='))).toEqual(Array.from(urlBase64ToUint8Array('+/8=')))
  })

  it('handles a string missing its base64 padding', () => {
    // VAPID public keys arrive without trailing '=' padding
    expect(Array.from(urlBase64ToUint8Array('aGVsbG8'))).toEqual([104, 101, 108, 108, 111])
  })
})
