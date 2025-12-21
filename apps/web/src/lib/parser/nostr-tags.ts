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

// Super mention regex (@@label format)
const SUPER_MENTION_REGEX =
  /(^|[\s>])@@([\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\u25A0-\u25FF\-:.?=&%#,/]+)/g

const PROTOCOL_PREFIX = /^https?:\/\//i

function getWikipediaUrl(wikidataId: string): string {
  return `https://www.wikidata.org/wiki/Special:GoToLinkedPage/jawiki/${wikidataId}`
}

function stripProtocol(label: string): string {
  return label.replace(PROTOCOL_PREFIX, '')
}

// Use built-in URL class for robust URL detection
function isUrlLike(label: string): boolean {
  const withProtocol = PROTOCOL_PREFIX.test(label) ? label : `https://${label}`
  try {
    const url = new URL(withProtocol)
    // Must have a valid hostname with at least one dot (not localhost)
    return url.hostname.includes('.')
  } catch {
    return false
  }
}

// Process super mentions in HTML
export function processSuperMentions(html: string, wikidataMap?: Record<string, string>): string {
  return html.replace(SUPER_MENTION_REGEX, (_match, prefix, label) => {
    // Check if it's a URL reference
    if (isUrlLike(label)) {
      const domainAndPath = stripProtocol(label)
      const url = `https://${domainAndPath}`
      return `${prefix}<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="content-super-mention content-super-mention-url"><span class="super-mention-prefix">@@</span>${escapeHtml(domainAndPath)}</a>`
    }

    // Wikidata reference
    const escapedLabel = escapeHtml(label)
    const wikidataId = wikidataMap?.[label]
    const qBadge = wikidataId
      ? ` <a href="${getWikipediaUrl(wikidataId)}" target="_blank" rel="noopener noreferrer" class="content-q-badge" title="Wikipediaで開く">${escapeHtml(wikidataId)}</a>`
      : ''
    return `${prefix}<button class="content-super-mention" data-ref="${escapedLabel}"><span class="super-mention-prefix">@@</span>${escapedLabel}</button>${qBadge}`
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
