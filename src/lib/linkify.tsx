import type { ReactNode } from 'react'

const URL_PATTERN = /https?:\/\/[^\s]+/g

/**
 * Turns any bare URL in plain text into a real clickable link — Word-style
 * autoformat, not a rich-text editor. Stops propagation on click so a link
 * inside a tappable card (NoteCard) opens in a new tab instead of also
 * opening the card's edit modal.
 */
export function linkifyText(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const pattern = new RegExp(URL_PATTERN)

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const url = match[0]
    nodes.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className="break-all text-brand-600 underline hover:text-brand-700"
      >
        {url}
      </a>
    )
    lastIndex = match.index + url.length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))

  return nodes
}
