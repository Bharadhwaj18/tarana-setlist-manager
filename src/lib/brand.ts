/**
 * The product's name lives here and nowhere else. "ArtistOps" is a placeholder: change these
 * values (and public/manifest.json, public/offline.html, public/sw.js, src/app/icon.svg and
 * public/icon.svg, which are static files and can't import this) when the real name is chosen.
 */

/** The name split for the wordmark (second part is set bolder and in the accent colour). Keep it a two-part split. */
export const APP_NAME_PARTS = ['Artist', 'Ops'] as const

export const APP_NAME = APP_NAME_PARTS.join('')
export const APP_TAGLINE = 'Everything an artist runs on'
/** Lower-case, no spaces: for file names. */
export const APP_SLUG = 'artistops'
export const APP_EMAIL_PLACEHOLDER = 'you@example.com'
