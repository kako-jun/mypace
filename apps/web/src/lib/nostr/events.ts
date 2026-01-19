import { finalizeEvent, type EventTemplate } from 'nostr-tools'
import { hasNip07, getOrCreateSecretKey, getPublicKeyFromSecret } from './keys'
import { MYPACE_TAG, AURORA_TAG } from './constants'
import { hasMypaceTag } from './tags'
import { getStoredThemeColors } from './theme'
import { unixNow } from '../utils'
import type { Event, Profile } from '../../types'

export { MYPACE_TAG, APP_TITLE } from './constants'
export { getEventThemeColors, getThemeCardProps, isDarkColor, getStoredThemeColors } from './theme'
export { formatTimestamp } from './format'

export async function createTextNote(
  content: string,
  preserveTags?: string[][],
  additionalTags?: string[][]
): Promise<Event> {
  const tags: string[][] = [
    ['t', MYPACE_TAG],
    ['client', 'mypace'],
  ]

  const themeColors = getStoredThemeColors()
  if (themeColors) {
    tags.push([AURORA_TAG, themeColors.topLeft, themeColors.topRight, themeColors.bottomLeft, themeColors.bottomRight])
  }

  if (preserveTags) {
    for (const tag of preserveTags) {
      if (tag[0] === 'e' || tag[0] === 'p') {
        tags.push(tag)
      }
    }
  }

  // Add additional tags (e.g., sticker tags)
  if (additionalTags) {
    tags.push(...additionalTags)
  }

  // Extract super mentions (@@label) and add as t tags
  const superMentionRegex = /@@([\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\u25A0-\u25FF\-:.?=&%#,/]+)/g
  const refs = new Set<string>()
  let match
  while ((match = superMentionRegex.exec(content)) !== null) {
    refs.add(match[1])
  }
  for (const ref of refs) {
    tags.push(['t', ref])
  }

  const template: EventTemplate = {
    kind: 1,
    created_at: unixNow(),
    tags,
    content,
  }

  if (hasNip07() && window.nostr) {
    return (await window.nostr.signEvent(template)) as Event
  }

  return finalizeEvent(template, getOrCreateSecretKey())
}

export async function createProfileEvent(profile: Profile): Promise<Event> {
  // Extract emojis for tags (NIP-30)
  const tags: string[][] = []
  if (profile.emojis) {
    for (const emoji of profile.emojis) {
      tags.push(['emoji', emoji.shortcode, emoji.url])
    }
  }

  // Remove emojis from content JSON (they go in tags, not content)
  const { emojis: _emojis, ...profileContent } = profile

  const template: EventTemplate = {
    kind: 0,
    created_at: unixNow(),
    tags,
    content: JSON.stringify(profileContent),
  }

  if (hasNip07() && window.nostr) {
    return (await window.nostr.signEvent(template)) as Event
  }

  return finalizeEvent(template, getOrCreateSecretKey())
}

export async function createDeleteEvent(eventIds: string[]): Promise<Event> {
  const template: EventTemplate = {
    kind: 5,
    created_at: unixNow(),
    tags: eventIds.map((id) => ['e', id]),
    content: '',
  }

  if (hasNip07() && window.nostr) {
    return (await window.nostr.signEvent(template)) as Event
  }

  return finalizeEvent(template, getOrCreateSecretKey())
}

export async function createNip98AuthEvent(url: string, method: string): Promise<Event> {
  const template: EventTemplate = {
    kind: 27235,
    created_at: unixNow(),
    tags: [
      ['u', url],
      ['method', method],
    ],
    content: '',
  }

  if (hasNip07() && window.nostr) {
    return (await window.nostr.signEvent(template)) as Event
  }

  return finalizeEvent(template, getOrCreateSecretKey())
}

// Max stella per user per post
export const MAX_STELLA_PER_USER = 10
// Custom tag for stella count
export const STELLA_TAG = 'stella'

// Stella colors with their sats value (for colored stella)
export type StellaColor = 'yellow' | 'green' | 'red' | 'blue' | 'purple'

export const STELLA_COLORS: Record<StellaColor, { label: string; sats: number; hex: string }> = {
  yellow: { label: 'Yellow', sats: 0, hex: '#f1c40f' },
  green: { label: 'Green', sats: 1, hex: '#2ecc71' },
  red: { label: 'Red', sats: 10, hex: '#e74c3c' },
  blue: { label: 'Blue', sats: 100, hex: '#3498db' },
  purple: { label: 'Purple', sats: 1000, hex: '#9b59b6' },
} as const

// Stella counts per color type
export interface StellaCountsByColor {
  yellow: number
  green: number
  red: number
  blue: number
  purple: number
}

// Empty stella counts
export const EMPTY_STELLA_COUNTS: StellaCountsByColor = {
  yellow: 0,
  green: 0,
  red: 0,
  blue: 0,
  purple: 0,
}

// Parse all stella tags from an event: ["stella", "color", "count"] for each color
// If no stella tags found, defaults to yellow: 1 for backward compatibility with NIP-25
export function parseStellaTags(tags: string[][]): StellaCountsByColor {
  const counts: StellaCountsByColor = { ...EMPTY_STELLA_COUNTS }

  const stellaTags = tags.filter((t) => t[0] === 'stella')

  // No stella tags - default to 1 yellow (backward compatibility with standard NIP-25 reactions)
  if (stellaTags.length === 0) {
    counts.yellow = 1
    return counts
  }

  for (const tag of stellaTags) {
    // New format: ["stella", "color", "count"]
    if (tag.length >= 3 && isValidStellaColor(tag[1])) {
      const count = parseInt(tag[2], 10)
      if (!isNaN(count) && count > 0) {
        counts[tag[1] as StellaColor] = Math.min(count, MAX_STELLA_PER_USER)
      }
    }
    // Old format: ["stella", "count"] - defaults to yellow
    else if (tag.length >= 2) {
      const count = parseInt(tag[1], 10)
      if (!isNaN(count) && count > 0) {
        counts.yellow = Math.min(count, MAX_STELLA_PER_USER)
      }
    }
  }

  return counts
}

// Get total stella count from StellaCountsByColor
export function getTotalStellaCount(counts: StellaCountsByColor): number {
  return counts.yellow + counts.green + counts.red + counts.blue + counts.purple
}

function isValidStellaColor(value: string): value is StellaColor {
  return ['yellow', 'green', 'red', 'blue', 'purple'].includes(value)
}

// Create reaction event with multiple stella colors
export async function createReactionEvent(
  targetEvent: Event,
  content: string = '+',
  stellaCounts: StellaCountsByColor = { ...EMPTY_STELLA_COUNTS, yellow: 1 }
): Promise<Event> {
  const tags: string[][] = [
    ['e', targetEvent.id],
    ['p', targetEvent.pubkey],
  ]

  // Add stella tag for each color with count > 0
  for (const color of ['yellow', 'green', 'red', 'blue', 'purple'] as StellaColor[]) {
    const count = stellaCounts[color]
    if (count > 0) {
      tags.push([STELLA_TAG, color, String(Math.min(count, MAX_STELLA_PER_USER))])
    }
  }

  const template: EventTemplate = {
    kind: 7,
    created_at: unixNow(),
    tags,
    content,
  }

  if (hasNip07() && window.nostr) {
    return (await window.nostr.signEvent(template)) as Event
  }

  return finalizeEvent(template, getOrCreateSecretKey())
}

export async function createRepostEvent(targetEvent: Event): Promise<Event> {
  const tags: string[][] = [
    ['e', targetEvent.id, ''],
    ['p', targetEvent.pubkey],
  ]

  // 元投稿がmypaceタグ付きなら、リポストにもmypaceタグを付ける
  if (hasMypaceTag(targetEvent)) {
    tags.push(['t', MYPACE_TAG])
  }

  const template: EventTemplate = {
    kind: 6,
    created_at: unixNow(),
    tags,
    content: JSON.stringify(targetEvent),
  }

  if (hasNip07() && window.nostr) {
    return (await window.nostr.signEvent(template)) as Event
  }

  return finalizeEvent(template, getOrCreateSecretKey())
}

export async function createReplyEvent(
  content: string,
  replyTo: Event,
  rootEvent?: Event,
  additionalTags?: string[][]
): Promise<Event> {
  const tags: string[][] = [
    ['t', MYPACE_TAG],
    ['client', 'mypace'],
  ]

  const themeColors = getStoredThemeColors()
  if (themeColors) {
    tags.push([AURORA_TAG, themeColors.topLeft, themeColors.topRight, themeColors.bottomLeft, themeColors.bottomRight])
  }

  if (rootEvent && rootEvent.id !== replyTo.id) {
    tags.push(['e', rootEvent.id, '', 'root'])
    tags.push(['e', replyTo.id, '', 'reply'])
    tags.push(['p', rootEvent.pubkey])
    if (replyTo.pubkey !== rootEvent.pubkey) {
      tags.push(['p', replyTo.pubkey])
    }
  } else {
    tags.push(['e', replyTo.id, '', 'root'])
    tags.push(['p', replyTo.pubkey])
  }

  // Add additional tags (e.g., sticker tags)
  if (additionalTags) {
    tags.push(...additionalTags)
  }

  // Extract super mentions (@@label) and add as t tags
  const superMentionRegex = /@@([\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\u25A0-\u25FF\-:.?=&%#,/]+)/g
  const refs = new Set<string>()
  let match
  while ((match = superMentionRegex.exec(content)) !== null) {
    refs.add(match[1])
  }
  for (const ref of refs) {
    tags.push(['t', ref])
  }

  const template: EventTemplate = {
    kind: 1,
    created_at: unixNow(),
    tags,
    content,
  }

  if (hasNip07() && window.nostr) {
    return (await window.nostr.signEvent(template)) as Event
  }

  return finalizeEvent(template, getOrCreateSecretKey())
}

export async function getCurrentPubkey(): Promise<string> {
  if (hasNip07() && window.nostr) {
    return await window.nostr.getPublicKey()
  }

  return getPublicKeyFromSecret(getOrCreateSecretKey())
}
