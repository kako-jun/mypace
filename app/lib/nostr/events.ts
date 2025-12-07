import { finalizeEvent, type EventTemplate, type Event } from 'nostr-tools'
import { hasNip07, getOrCreateSecretKey, getPublicKeyFromSecret } from './keys'
import { MYPACE_TAG } from './constants'
import { getStoredThemeColors } from './theme'
import { THEME_TAG } from '../constants'
import { unixNow } from '../utils'
import type { Profile, ThemeColors } from '../../types'

export { MYPACE_TAG, APP_TITLE } from './constants'
export type { Profile, ThemeColors }
export { getEventThemeColors, getThemeCardProps, isDarkColor, getStoredThemeColors } from './theme'
export { formatTimestamp } from './format'

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

  const template: EventTemplate = {
    kind: 1,
    created_at: unixNow(),
    tags,
    content,
  }

  if (hasNip07() && window.nostr) {
    return await window.nostr.signEvent(template) as Event
  }

  return finalizeEvent(template, getOrCreateSecretKey())
}

export async function createProfileEvent(profile: Profile): Promise<Event> {
  const template: EventTemplate = {
    kind: 0,
    created_at: unixNow(),
    tags: [],
    content: JSON.stringify(profile),
  }

  if (hasNip07() && window.nostr) {
    return await window.nostr.signEvent(template) as Event
  }

  return finalizeEvent(template, getOrCreateSecretKey())
}

export async function createDeleteEvent(eventIds: string[]): Promise<Event> {
  const template: EventTemplate = {
    kind: 5,
    created_at: unixNow(),
    tags: eventIds.map(id => ['e', id]),
    content: '',
  }

  if (hasNip07() && window.nostr) {
    return await window.nostr.signEvent(template) as Event
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
    return await window.nostr.signEvent(template) as Event
  }

  return finalizeEvent(template, getOrCreateSecretKey())
}

export async function createReactionEvent(targetEvent: Event, content: string = '+'): Promise<Event> {
  const template: EventTemplate = {
    kind: 7,
    created_at: unixNow(),
    tags: [
      ['e', targetEvent.id],
      ['p', targetEvent.pubkey],
    ],
    content,
  }

  if (hasNip07() && window.nostr) {
    return await window.nostr.signEvent(template) as Event
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
    return await window.nostr.signEvent(template) as Event
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
    return await window.nostr.signEvent(template) as Event
  }

  return finalizeEvent(template, getOrCreateSecretKey())
}

export async function getCurrentPubkey(): Promise<string> {
  if (hasNip07() && window.nostr) {
    return await window.nostr.getPublicKey()
  }

  return getPublicKeyFromSecret(getOrCreateSecretKey())
}
