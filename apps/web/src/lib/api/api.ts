// API client for mypace backend
import type { Event, Profile, ReactionData, ReplyData, RepostData } from '../../types'

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
  until = 0,
  showSNS = true,
  showBlog = true,
  hideAds = true,
  hideNSFW = true
): Promise<{ events: Event[]; source: string }> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (since > 0) params.set('since', String(since))
  if (until > 0) params.set('until', String(until))
  if (!mypaceOnly) params.set('all', '1')
  if (language) params.set('lang', language)
  // Set kinds parameter based on showSNS and showBlog
  const kindsList: number[] = []
  if (showSNS) kindsList.push(1)
  if (showBlog) kindsList.push(30023)
  if (kindsList.length > 0) {
    params.set('kinds', kindsList.join(','))
  }
  // Smart filters: send 0 when OFF (default is ON on server)
  if (!hideAds) params.set('hideAds', '0')
  if (!hideNSFW) params.set('hideNSFW', '0')

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

// Wikidata search
export interface WikidataResult {
  id: string
  label: string
  description: string
  aliases: string[]
}

export async function searchWikidata(query: string, lang = 'ja'): Promise<WikidataResult[]> {
  if (!query || query.length < 1) return []

  const params = new URLSearchParams({ q: query, lang })
  const res = await fetch(`${API_BASE}/api/wikidata/search?${params}`)
  if (!res.ok) throw new Error('Failed to search Wikidata')
  const data = await res.json()
  return data.results || []
}

// Super mention path suggestion
export interface SuperMentionSuggestion {
  path: string
  category: string
  wikidataId: string | null
  wikidataLabel: string | null
  wikidataDescription: string | null
  useCount: number
}

export async function getSuperMentionSuggestions(
  prefix?: string,
  category?: string,
  limit = 10
): Promise<SuperMentionSuggestion[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (prefix) params.set('prefix', prefix)
  if (category) params.set('category', category)

  const res = await fetch(`${API_BASE}/api/super-mention/suggest?${params}`)
  if (!res.ok) throw new Error('Failed to get suggestions')
  const data = await res.json()
  return data.suggestions || []
}

// Save super mention path
export async function saveSuperMentionPath(
  path: string,
  category: string,
  wikidataId?: string,
  wikidataLabel?: string,
  wikidataDescription?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/super-mention/paths`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path,
      category,
      wikidataId,
      wikidataLabel,
      wikidataDescription,
    }),
  })
  if (!res.ok) throw new Error('Failed to save path')
}
