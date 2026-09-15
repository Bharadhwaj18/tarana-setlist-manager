import { describe, it, expect } from 'vitest'
import { isValidElement, type ReactElement } from 'react'
import { linkifyText } from './linkify'

function hrefOf(node: unknown) {
  return (node as ReactElement<{ href: string }>).props.href
}

describe('linkifyText', () => {
  it('returns plain text unchanged when there is no URL', () => {
    expect(linkifyText('just some plain text')).toEqual(['just some plain text'])
  })

  it('turns a bare URL into a link element', () => {
    const result = linkifyText('check this out: https://example.com/path')
    expect(result[0]).toBe('check this out: ')
    expect(isValidElement(result[1])).toBe(true)
    expect(hrefOf(result[1])).toBe('https://example.com/path')
  })

  it('handles multiple URLs with text in between and after', () => {
    const result = linkifyText('a https://a.com b https://b.com c')
    expect(result).toHaveLength(5)
    expect(result[0]).toBe('a ')
    expect(hrefOf(result[1])).toBe('https://a.com')
    expect(result[2]).toBe(' b ')
    expect(hrefOf(result[3])).toBe('https://b.com')
    expect(result[4]).toBe(' c')
  })

  it('links a URL that is the entire string, with nothing left over', () => {
    const result = linkifyText('https://example.com')
    expect(result).toHaveLength(1)
    expect(hrefOf(result[0])).toBe('https://example.com')
  })

  it('opens in a new tab with rel=noopener', () => {
    const result = linkifyText('https://example.com')
    const el = result[0] as ReactElement<{ target: string; rel: string }>
    expect(el.props.target).toBe('_blank')
    expect(el.props.rel).toBe('noopener noreferrer')
  })
})
