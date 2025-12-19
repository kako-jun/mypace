import { finalizeEvent, type EventTemplate } from 'nostr-tools'
import { nip19 } from 'nostr-tools'
import { hasNip07, getOrCreateSecretKey, getPublicKeyFromSecret } from './keys'
import { MYPACE_TAG, AURORA_TAG, MYPACE_URL } from './constants'
import { getStoredThemeColors } from './theme'
import { unixNow } from '../utils'
import { LIMITS } from '../constants'
import type { Event, Profile } from '../../types'

export { MYPACE_TAG, APP_TITLE } from './constants'
export { getEventThemeColors, getThemeCardProps, isDarkColor, getStoredThemeColors } from './theme'
export { formatTimestamp } from './format'

export async function createTextNote(
  content: string,
  preserveTags?: string[][],
  additionalTags?: string[][]
): Promise<Event> {
  // Determine signing method and pubkey upfront to ensure consistency
  const useNip07 = hasNip07() && window.nostr
  let signerPubkey: string
  let secretKey: Uint8Array | null = null

  if (useNip07) {
    signerPubkey = await window.nostr!.getPublicKey()
  } else {
    secretKey = getOrCreateSecretKey()
    signerPubkey = getPublicKeyFromSecret(secretKey)
  }

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

  // Handle long posts: split content and add fold tag
  let finalContent = content
  if (content.length > LIMITS.FOLD_THRESHOLD) {
    const npub = nip19.npubEncode(signerPubkey)
    const preview = content.slice(0, LIMITS.FOLD_THRESHOLD)
    const folded = content.slice(LIMITS.FOLD_THRESHOLD)

    // Add fold tag with the rest of the content
    tags.push(['teaser', folded])

    // Create preview content with READ MORE link
    // Note: We use profile URL since event ID cannot be known before signing
    finalContent = `${preview}\n\n...READ MORE → ${MYPACE_URL}/user/${npub}`
  }

  const template: EventTemplate = {
    kind: 1,
    created_at: unixNow(),
    tags,
    content: finalContent,
  }

  if (useNip07) {
    return (await window.nostr!.signEvent(template)) as Event
  }

  return finalizeEvent(template, secretKey!)
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

export async function createReactionEvent(
  targetEvent: Event,
  content: string = '+',
  stellaCount: number = 1
): Promise<Event> {
  const template: EventTemplate = {
    kind: 7,
    created_at: unixNow(),
    tags: [
      ['e', targetEvent.id],
      ['p', targetEvent.pubkey],
      [STELLA_TAG, String(Math.min(stellaCount, MAX_STELLA_PER_USER))],
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
