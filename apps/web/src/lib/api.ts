// API client for mypace backend
import type { Event, Profile, ReactionData, ReplyData, RepostData } from '../types'

export const API_BASE =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://api.mypace.llll-ll.com' : 'http://localhost:8787')

// Re-export types for convenience
export type { Event, Profile, ReactionData, ReplyData, RepostData }

// Timeline
export async function fetchTimeline(
  limit = 50,
  since = 0,
  mypaceOnly = true,
  language = '',
  until = 0
): Promise<{ events: Event[]; source: string }> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (since > 0) params.set('since', String(since))
  if (until > 0) params.set('until', String(until))
  if (!mypaceOnly) params.set('all', '1')
  if (language) params.set('lang', language)

  const res = await fetch(`${API_BASE}/api/timeline?${params}`)
  if (!res.ok) throw new Error('Failed to fetch timeline')
  return res.json()
}

// Single event
export async function fetchEvent(id: string): Promise<{ event: Event; source: string }> {
  const res = await fetch(`${API_BASE}/api/events/${id}`)
  if (!res.ok) throw new Error('Failed to fetch event')
  return res.json()
}

// Profiles
export async function fetchProfiles(pubkeys: string[]): Promise<{ profiles: Record<string, Profile> }> {
  if (pubkeys.length === 0) return { profiles: {} }

  const res = await fetch(`${API_BASE}/api/profiles?pubkeys=${pubkeys.join(',')}`)
  if (!res.ok) throw new Error('Failed to fetch profiles')
  return res.json()
}

// Reactions
export async function fetchReactions(eventId: string, myPubkey?: string): Promise<ReactionData> {
  const params = new URLSearchParams()
  if (myPubkey) params.set('pubkey', myPubkey)

  const res = await fetch(`${API_BASE}/api/reactions/${eventId}?${params}`)
  if (!res.ok) throw new Error('Failed to fetch reactions')
  return res.json()
}

// Replies
export async function fetchReplies(eventId: string): Promise<ReplyData> {
  const res = await fetch(`${API_BASE}/api/replies/${eventId}`)
  if (!res.ok) throw new Error('Failed to fetch replies')
  return res.json()
}

// Reposts
export async function fetchReposts(eventId: string, myPubkey?: string): Promise<RepostData> {
  const params = new URLSearchParams()
  if (myPubkey) params.set('pubkey', myPubkey)

  const res = await fetch(`${API_BASE}/api/reposts/${eventId}?${params}`)
  if (!res.ok) throw new Error('Failed to fetch reposts')
  return res.json()
}

// User events
export async function fetchUserEvents(pubkey: string, limit = 50, since = 0, until = 0): Promise<{ events: Event[] }> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (since > 0) params.set('since', String(since))
  if (until > 0) params.set('until', String(until))

  const res = await fetch(`${API_BASE}/api/user/${pubkey}/events?${params}`)
  if (!res.ok) throw new Error('Failed to fetch user events')
  return res.json()
}

// Publish signed event
export async function publishEvent(event: Event): Promise<{ success: boolean; id: string; relays?: number }> {
  const res = await fetch(`${API_BASE}/api/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    const message = errorData.error || 'Failed to publish event'
    console.error('Publish failed:', errorData)
    throw new Error(message)
  }
  return res.json()
}
