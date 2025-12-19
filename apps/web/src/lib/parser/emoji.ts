import { escapeHtml } from './html-utils'
import type { EmojiTag } from '../../types'

// Process custom emojis (NIP-30)
export function processCustomEmojis(html: string, emojis: EmojiTag[]): string {
  if (!emojis.length) return html
  const emojiMap = new Map(emojis.map((e) => [e.shortcode, e.url]))
  return html.replace(/:([a-zA-Z0-9_]+):/g, (match, shortcode) => {
    const url = emojiMap.get(shortcode)
    if (url) {
      return `<img src="${escapeHtml(url)}" alt=":${escapeHtml(shortcode)}:" class="custom-emoji" loading="lazy" />`
    }
    return match
  })
}
