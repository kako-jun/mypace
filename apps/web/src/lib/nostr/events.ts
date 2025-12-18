import { finalizeEvent, type EventTemplate } from 'nostr-tools'
import { nip19 } from 'nostr-tools'
import { hasNip07, getOrCreateSecretKey, getPublicKeyFromSecret } from './keys'
import { MYPACE_TAG, THEME_TAG, MYPACE_URL } from './constants'
import { getStoredThemeColors } from './theme'
import { unixNow } from '../utils'
import { LIMITS } from '../constants'
import type { Event, Profile } from '../../types'

export { MYPACE_TAG, APP_TITLE } from './constants'
export { getEventThemeColors, getThemeCardProps, isDarkColor, getStoredThemeColors } from './theme'
export { formatTimestamp } from './format'

// Get current user's pubkey for READ MORE link
async function getCurrentPubkeyForLink(): Promise<string> {
  if (hasNip07() && window.nostr) {
    return await window.nostr.getPublicKey()
  }
  return getPublicKeyFromSecret(getOrCreateSecretKey())
}

export async function createTextNote(content: string, preserveTags?: string[][]): Promise<Event> {
  const tags: string[][] = [
    ['t', MYPACE_TAG],
    ['client', 'mypace'],
  ]

  const themeColors = getStoredThemeColors()
  if (themeColors) {
    tags.push([THEME_TAG, themeColors.topLeft, themeColors.topRight, themeColors.bottomLeft, themeColors.bottomRight])
  }

  if (preserveTags) {
    for (const tag of preserveTags) {
      if (tag[0] === 'e' || tag[0] === 'p') {
        tags.push(tag)
      }
    }
  }

  // Handle long posts: split content and add fold tag
  let finalContent = content
  if (content.length > LIMITS.FOLD_THRESHOLD) {
    const pubkey = await getCurrentPubkeyForLink()
    const npub = nip19.npubEncode(pubkey)
    const preview = content.slice(0, LIMITS.FOLD_THRESHOLD)
    const folded = content.slice(LIMITS.FOLD_THRESHOLD)

    // Add fold tag with the rest of the content
    tags.push(['mypace', 'fold', folded])

    // Create preview content with READ MORE link
    // Note: We use profile URL since event ID cannot be known before signing
    finalContent = `${preview}\n\n...READ MORE → ${MYPACE_URL}/profile/${npub}`
  }

  const template: EventTemplate = {
    kind: 1,
    created_at: unixNow(),
    tags,
    content: finalContent,
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

// Max stars per user per post
export const MAX_STARS_PER_USER = 10
// Custom tag for mypace star count
export const MYPACE_STARS_TAG = 'mypace_stars'

export async function createReactionEvent(
  targetEvent: Event,
  content: string = '+',
  starCount: number = 1
): Promise<Event> {
  const template: EventTemplate = {
    kind: 7,
    created_at: unixNow(),
    tags: [
      ['e', targetEvent.id],
      ['p', targetEvent.pubkey],
      [MYPACE_STARS_TAG, String(Math.min(starCount, MAX_STARS_PER_USER))],
    ],
    content,
  }

  if (hasNip07() && window.nostr) {
    return (await window.nostr.signEvent(template)) as Event
  }

  return finalizeEvent(template, getOrCreateSecretKey())
}

export async function createRepostEvent(targetEvent: Event): Promise<Event> {
  const template: EventTemplate = {
    kind: 6,
    created_at: unixNow(),
    tags: [
      ['e', targetEvent.id, ''],
      ['p', targetEvent.pubkey],
    ],
    content: JSON.stringify(targetEvent),
  }

  if (hasNip07() && window.nostr) {
    return (await window.nostr.signEvent(template)) as Event
  }

  return finalizeEvent(template, getOrCreateSecretKey())
}

export async function createReplyEvent(content: string, replyTo: Event, rootEvent?: Event): Promise<Event> {
  const tags: string[][] = [
    ['t', MYPACE_TAG],
    ['client', 'mypace'],
  ]

  const themeColors = getStoredThemeColors()
  if (themeColors) {
    tags.push([THEME_TAG, themeColors.topLeft, themeColors.topRight, themeColors.bottomLeft, themeColors.bottomRight])
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
