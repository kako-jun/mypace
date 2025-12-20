import { nip19 } from 'nostr-tools'
import { escapeHtml } from './html-utils'
import type { ProfileMap } from '../../types'

// Hashtag regex (requires whitespace or start of string before #)
const HASHTAG_REGEX = /(^|[\s>])#([a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+)/g

// Process hashtags in HTML (after markdown parsing)
export function processHashtags(html: string): string {
  return html.replace(HASHTAG_REGEX, (match, prefix, tag) => {
    const escapedTag = escapeHtml(tag)
    const randomDelay = Math.random() * 18
    return `${prefix}<button class="content-hashtag" data-tag="${escapedTag}" style="animation-delay: ${randomDelay.toFixed(1)}s">#${escapeHtml(tag)}</button>`
  })
}

// Super mention regex
const SUPER_MENTION_REGEX =
  /(^|[\s>])@(\/[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\u25A0-\u25FF\-/:.?=&%#,]+)/g

// Process super mentions in HTML
export function processSuperMentions(html: string): string {
  return html.replace(SUPER_MENTION_REGEX, (_match, prefix, path) => {
    const escapedPath = escapeHtml(path)
    return `${prefix}<button class="content-super-mention" data-ref="${escapedPath}"><span class="super-mention-prefix">@/</span>${escapeHtml(path.slice(1))}</button>`
  })
}

// Nostr URI regex (NIP-19)
const NOSTR_URI_REGEX = /nostr:(npub1[a-zA-Z0-9]+|nprofile1[a-zA-Z0-9]+|note1[a-zA-Z0-9]+|nevent1[a-zA-Z0-9]+)/g

function isValidHex(hex: string, expectedLength = 64): boolean {
  return typeof hex === 'string' && hex.length === expectedLength && /^[0-9a-f]+$/i.test(hex)
}

// Process Nostr URIs (NIP-19 mentions and references)
export function processNostrMentions(html: string, profiles: ProfileMap): string {
  return html.replace(NOSTR_URI_REGEX, (match, encoded: string) => {
    try {
      const decoded = nip19.decode(encoded)
      const type = decoded.type

      if (type === 'npub') {
        const pubkey = decoded.data as string
        if (!isValidHex(pubkey)) return match
        const profile = profiles[pubkey]
        const displayName = profile?.name || profile?.display_name || `${encoded.slice(0, 12)}...`
        return `<a href="/user/${encoded}" class="nostr-mention" data-pubkey="${pubkey}">@${escapeHtml(displayName)}</a>`
      }

      if (type === 'nprofile') {
        const data = decoded.data as { pubkey: string; relays?: string[] }
        const pubkey = data.pubkey
        if (!isValidHex(pubkey)) return match
        const profile = profiles[pubkey]
        const displayName = profile?.name || profile?.display_name || `${encoded.slice(0, 12)}...`
        const npub = nip19.npubEncode(pubkey)
        return `<a href="/user/${npub}" class="nostr-mention" data-pubkey="${pubkey}">@${escapeHtml(displayName)}</a>`
      }

      if (type === 'note') {
        const noteId = decoded.data as string
        if (!isValidHex(noteId)) return match
        return `<a href="/post/${noteId}" class="nostr-note-ref">📝 note</a>`
      }

      if (type === 'nevent') {
        const data = decoded.data as { id: string; relays?: string[]; author?: string }
        if (!isValidHex(data.id)) return match
        return `<a href="/post/${data.id}" class="nostr-note-ref">📝 note</a>`
      }

      return match
    } catch {
      return match
    }
  })
}
