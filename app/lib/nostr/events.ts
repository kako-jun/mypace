import { finalizeEvent, type EventTemplate, type Event } from 'nostr-tools'
import {
  hasNip07,
  getOrCreateSecretKey,
  getPublicKeyFromSecret,
} from './keys'

export interface Profile {
  name?: string
  display_name?: string
  picture?: string
  about?: string
}

export interface ThemeColors {
  topLeft: string
  topRight: string
  bottomLeft: string
  bottomRight: string
}

export const MYPACE_TAG = 'mypace'
export const APP_TITLE = 'MY★PACE'

// Get stored theme colors from localStorage
function getStoredThemeColors(): ThemeColors | null {
  if (typeof localStorage === 'undefined') return null
  const stored = localStorage.getItem('mypace_theme_colors')
  const enabled = localStorage.getItem('mypace_theme_enabled')
  if (stored && enabled === 'true') {
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  }
  return null
}

export async function createTextNote(content: string, preserveTags?: string[][]): Promise<Event> {
  const tags: string[][] = [
    ['t', MYPACE_TAG],
    ['client', 'mypace'],
  ]

  // Add theme colors if enabled
  const themeColors = getStoredThemeColors()
  if (themeColors) {
    tags.push(['mypace_theme', themeColors.topLeft, themeColors.topRight, themeColors.bottomLeft, themeColors.bottomRight])
  }

  // Preserve e and p tags from original event (for replies)
  if (preserveTags) {
    for (const tag of preserveTags) {
      if (tag[0] === 'e' || tag[0] === 'p') {
        tags.push(tag)
      }
    }
  }

  const template: EventTemplate = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
  }

  if (hasNip07() && window.nostr) {
    const signed = await window.nostr.signEvent(template)
    return signed as Event
  }

  const sk = getOrCreateSecretKey()
  return finalizeEvent(template, sk)
}

// Extract theme colors from event tags
export function getEventThemeColors(event: Event): ThemeColors | null {
  const themeTag = event.tags.find(tag => tag[0] === 'mypace_theme')
  if (themeTag && themeTag.length >= 5) {
    return {
      topLeft: themeTag[1],
      topRight: themeTag[2],
      bottomLeft: themeTag[3],
      bottomRight: themeTag[4],
    }
  }
  return null
}

// Calculate relative luminance of a hex color
function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

// Determine if color is dark
export function isDarkColor(hex: string): boolean {
  return getLuminance(hex) < 0.4
}

// Get theme card props (style and classes)
export function getThemeCardProps(colors: ThemeColors | null): {
  style: Record<string, string>
  className: string
} {
  if (!colors) {
    return { style: {}, className: '' }
  }

  const darkCount =
    (isDarkColor(colors.topLeft) ? 1 : 0) +
    (isDarkColor(colors.topRight) ? 1 : 0) +
    (isDarkColor(colors.bottomLeft) ? 1 : 0) +
    (isDarkColor(colors.bottomRight) ? 1 : 0)

  const avgDark = darkCount >= 2
  const textClass = avgDark ? 'light-text' : 'dark-text'

  return {
    style: {
      background: `
        radial-gradient(ellipse at top left, ${colors.topLeft}cc 0%, transparent 50%),
        radial-gradient(ellipse at top right, ${colors.topRight}cc 0%, transparent 50%),
        radial-gradient(ellipse at bottom left, ${colors.bottomLeft}cc 0%, transparent 50%),
        radial-gradient(ellipse at bottom right, ${colors.bottomRight}cc 0%, transparent 50%),
        linear-gradient(135deg, ${colors.topLeft} 0%, ${colors.bottomRight} 100%)
      `.trim()
    },
    className: `themed-card ${textClass}`
  }
}

// Get stored theme colors from localStorage (exported for reuse)
export function getLocalThemeColors(): ThemeColors | null {
  if (typeof localStorage === 'undefined') return null
  const stored = localStorage.getItem('mypace_theme_colors')
  const enabled = localStorage.getItem('mypace_theme_enabled')
  if (stored && enabled === 'true') {
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  }
  return null
}

export async function createProfileEvent(profile: Profile): Promise<Event> {
  const template: EventTemplate = {
    kind: 0,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: JSON.stringify(profile),
  }

  if (hasNip07() && window.nostr) {
    const signed = await window.nostr.signEvent(template)
    return signed as Event
  }

  const sk = getOrCreateSecretKey()
  return finalizeEvent(template, sk)
}

export async function createDeleteEvent(eventIds: string[]): Promise<Event> {
  const template: EventTemplate = {
    kind: 5,
    created_at: Math.floor(Date.now() / 1000),
    tags: eventIds.map(id => ['e', id]),
    content: '',
  }

  if (hasNip07() && window.nostr) {
    const signed = await window.nostr.signEvent(template)
    return signed as Event
  }

  const sk = getOrCreateSecretKey()
  return finalizeEvent(template, sk)
}


// NIP-98 HTTP Auth event for file uploads
export async function createNip98AuthEvent(url: string, method: string): Promise<Event> {
  const template: EventTemplate = {
    kind: 27235,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['u', url],
      ['method', method],
    ],
    content: '',
  }

  if (hasNip07() && window.nostr) {
    const signed = await window.nostr.signEvent(template)
    return signed as Event
  }

  const sk = getOrCreateSecretKey()
  return finalizeEvent(template, sk)
}

// NIP-25: Create reaction event (like)
export async function createReactionEvent(targetEvent: Event, content: string = '+'): Promise<Event> {
  const template: EventTemplate = {
    kind: 7,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', targetEvent.id],
      ['p', targetEvent.pubkey],
    ],
    content,
  }

  if (hasNip07() && window.nostr) {
    const signed = await window.nostr.signEvent(template)
    return signed as Event
  }

  const sk = getOrCreateSecretKey()
  return finalizeEvent(template, sk)
}

// NIP-18: Create repost event
export async function createRepostEvent(targetEvent: Event): Promise<Event> {
  const template: EventTemplate = {
    kind: 6,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', targetEvent.id, ''],
      ['p', targetEvent.pubkey],
    ],
    content: JSON.stringify(targetEvent),
  }

  if (hasNip07() && window.nostr) {
    const signed = await window.nostr.signEvent(template)
    return signed as Event
  }

  const sk = getOrCreateSecretKey()
  return finalizeEvent(template, sk)
}

// NIP-10: Create reply event
export async function createReplyEvent(content: string, replyTo: Event, rootEvent?: Event): Promise<Event> {
  const tags: string[][] = [
    ['t', MYPACE_TAG],
    ['client', 'mypace'],
  ]

  // Add theme colors if enabled
  const themeColors = getStoredThemeColors()
  if (themeColors) {
    tags.push(['mypace_theme', themeColors.topLeft, themeColors.topRight, themeColors.bottomLeft, themeColors.bottomRight])
  }

  // NIP-10: Add root and reply markers
  if (rootEvent && rootEvent.id !== replyTo.id) {
    // Replying to a reply in a thread
    tags.push(['e', rootEvent.id, '', 'root'])
    tags.push(['e', replyTo.id, '', 'reply'])
    tags.push(['p', rootEvent.pubkey])
    if (replyTo.pubkey !== rootEvent.pubkey) {
      tags.push(['p', replyTo.pubkey])
    }
  } else {
    // Replying directly to a root post
    tags.push(['e', replyTo.id, '', 'root'])
    tags.push(['p', replyTo.pubkey])
  }

  const template: EventTemplate = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
  }

  if (hasNip07() && window.nostr) {
    const signed = await window.nostr.signEvent(template)
    return signed as Event
  }

  const sk = getOrCreateSecretKey()
  return finalizeEvent(template, sk)
}

export async function getCurrentPubkey(): Promise<string> {
  if (hasNip07() && window.nostr) {
    return await window.nostr.getPublicKey()
  }

  const sk = getOrCreateSecretKey()
  return getPublicKeyFromSecret(sk)
}

export function formatTimestamp(ts: number): string {
  const date = new Date(ts * 1000)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`

  return date.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
  })
}
