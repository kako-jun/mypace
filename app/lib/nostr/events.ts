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

export const MYPACE_TAG = 'mypace'

export async function createTextNote(content: string): Promise<Event> {
  const template: EventTemplate = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['t', MYPACE_TAG],
      ['client', 'mypace'],
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
