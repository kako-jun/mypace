import { finalizeEvent, type EventTemplate, type Event } from 'nostr-tools'
import {
  hasNip07,
  getOrCreateSecretKey,
  getPublicKeyFromSecret,
} from './keys'

export async function createTextNote(content: string): Promise<Event> {
  const template: EventTemplate = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
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
