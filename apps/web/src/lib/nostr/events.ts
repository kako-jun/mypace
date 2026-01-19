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
  yellow: { label: 'イエロー', sats: 0, hex: '#f1c40f' },
  green: { label: 'グリーン', sats: 1, hex: '#2ecc71' },
  red: { label: 'レッド', sats: 10, hex: '#e74c3c' },
  blue: { label: 'ブルー', sats: 100, hex: '#3498db' },
  purple: { label: 'パープル', sats: 1000, hex: '#9b59b6' },
} as const

// Parse stella tag: ["stella", "count"] or ["stella", "color", "count"]
export function parseStellaTag(tags: string[][]): { count: number; color: StellaColor } {
  const stellaTag = tags.find((t) => t[0] === 'stella')
  if (!stellaTag) {
    return { count: 1, color: 'yellow' }
  }

  // New format: ["stella", "color", "count"]
  if (stellaTag.length >= 3 && isValidStellaColor(stellaTag[1])) {
    const count = parseInt(stellaTag[2], 10)
    return {
      color: stellaTag[1] as StellaColor,
      count: isNaN(count) ? 1 : count,
    }
  }

  // Old format: ["stella", "count"] - defaults to yellow
  const count = parseInt(stellaTag[1], 10)
  return {
    color: 'yellow',
    count: isNaN(count) ? 1 : count,
  }
}

function isValidStellaColor(value: string): value is StellaColor {
  return ['yellow', 'green', 'red', 'blue', 'purple'].includes(value)
}

export async function createReactionEvent(
  targetEvent: Event,
  content: string = '+',
  stellaCount: number = 1,
  stellaColor: StellaColor = 'yellow'
): Promise<Event> {
  // Build stella tag based on color
  const stellaTagValue =
    stellaColor === 'yellow'
      ? [STELLA_TAG, String(Math.min(stellaCount, MAX_STELLA_PER_USER))]
      : [STELLA_TAG, stellaColor, String(Math.min(stellaCount, MAX_STELLA_PER_USER))]

  const template: EventTemplate = {
    kind: 7,
    created_at: unixNow(),
    tags: [['e', targetEvent.id], ['p', targetEvent.pubkey], stellaTagValue],
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
