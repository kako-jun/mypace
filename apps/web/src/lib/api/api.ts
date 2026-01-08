// API client for mypace backend
import type { Event, Profile, ReactionData, ReplyData, RepostData } from '../../types'
import { loadFiltersFromStorage, getMutedPubkeys } from '../utils'

export const API_BASE =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://api.mypace.llll-ll.com' : 'http://localhost:8787')

// Re-export types for convenience
export type { Event, Profile, ReactionData, ReplyData, RepostData }

// Timeline options interface
interface TimelineOptions {
  limit?: number
  since?: number
  until?: number
  q?: string[] // Text search query (array of keywords)
  tags?: string[] // OK tags filter
}

// Timeline - loads filters from localStorage and sends to API
export async function fetchTimeline(options: TimelineOptions = {}): Promise<{ events: Event[]; source: string }> {
  const { limit = 50, since = 0, until = 0, q = [], tags = [] } = options

  // Load filters from localStorage
  const filters = loadFiltersFromStorage()
  const mutedPubkeys = getMutedPubkeys()

  const params = new URLSearchParams({ limit: String(limit) })
  if (since > 0) params.set('since', String(since))
  if (until > 0) params.set('until', String(until))
  if (!filters.mypace) params.set('all', '1')
  if (filters.lang) params.set('lang', filters.lang)

  // Set kinds parameter based on showSNS and showBlog
  // Each parameter is orthogonal - kinds determines what types, hideNPC filters NPC separately
  const kindsList: number[] = []
  if (filters.showSNS) {
    kindsList.push(1)
    kindsList.push(42000) // NPC posts (filtered by hideNPC param if needed)
  }
  if (filters.showBlog) kindsList.push(30023)
  // Always send kinds param (empty means no posts should match)
  params.set('kinds', kindsList.join(','))

  // Smart filters: send 0 when OFF (default is ON on server)
  if (!filters.hideAds) params.set('hideAds', '0')
  if (!filters.hideNSFW) params.set('hideNSFW', '0')
  if (filters.hideNPC) params.set('hideNPC', '1')

  // Mute list
  if (mutedPubkeys.length > 0) {
    params.set('mute', mutedPubkeys.join(','))
  }

  // NG words
  if (filters.ngWords.length > 0) {
    params.set('ng', filters.ngWords.map(encodeURIComponent).join('+'))
  }

  // NG tags
  if (filters.ngTags && filters.ngTags.length > 0) {
    params.set('ngtags', filters.ngTags.map(encodeURIComponent).join('+'))
  }

  // Public filters (from URL, not localStorage)
  if (q.length > 0) params.set('q', q.map(encodeURIComponent).join('+'))
  if (tags.length > 0) params.set('tags', tags.map(encodeURIComponent).join('+'))

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
interface UserEventsOptions {
  limit?: number
  since?: number
  until?: number
  tags?: string[] // Filter by hashtags
  q?: string[] // Text search query (array of keywords)
}

export async function fetchUserEvents(pubkey: string, options: UserEventsOptions = {}): Promise<{ events: Event[] }> {
  const { limit = 50, since = 0, until = 0, tags = [], q = [] } = options
  const params = new URLSearchParams({ limit: String(limit) })
  if (since > 0) params.set('since', String(since))
  if (until > 0) params.set('until', String(until))
  if (tags.length > 0) params.set('tags', tags.map(encodeURIComponent).join('+'))
  if (q.length > 0) params.set('q', q.map(encodeURIComponent).join('+'))

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
  wikidataId?: string,
  wikidataLabel?: string,
  wikidataDescription?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/super-mention/paths`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path,
      wikidataId,
      wikidataLabel,
      wikidataDescription,
    }),
  })
  if (!res.ok) throw new Error('Failed to save path')
}

// Delete super mention path from history (anyone can delete)
export async function deleteSuperMentionPath(path: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/super-mention/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    return res.ok
  } catch {
    return false
  }
}

// Lookup wikidata_id for multiple paths (with cache)
const wikidataCache = new Map<string, string>()

export async function lookupSuperMentionPaths(paths: string[]): Promise<Record<string, string>> {
  // Filter out already cached paths
  const uncachedPaths = paths.filter((p) => !wikidataCache.has(p))

  // Return from cache if all paths are cached
  if (uncachedPaths.length === 0) {
    const result: Record<string, string> = {}
    for (const p of paths) {
      const cached = wikidataCache.get(p)
      if (cached) result[p] = cached
    }
    return result
  }

  try {
    const res = await fetch(`${API_BASE}/api/super-mention/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: uncachedPaths }),
    })
    if (!res.ok) return {}

    const data = (await res.json()) as { mapping: Record<string, string> }

    // Cache the results
    for (const [path, wikidataId] of Object.entries(data.mapping)) {
      wikidataCache.set(path, wikidataId)
    }

    // Return all requested paths from cache
    const result: Record<string, string> = {}
    for (const p of paths) {
      const cached = wikidataCache.get(p)
      if (cached) result[p] = cached
    }
    return result
  } catch {
    return {}
  }
}

// Sticker history
export interface StickerHistoryItem {
  url: string
  useCount: number
}

export async function getStickerHistory(limit = 20): Promise<StickerHistoryItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/sticker/history?limit=${limit}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.stickers || []
  } catch {
    return []
  }
}

export async function saveStickerToHistory(url: string, pubkey?: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/sticker/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, pubkey }),
    })
  } catch {
    // Silently fail
  }
}

// Delete sticker from history (anyone can delete)
export async function deleteStickerFromHistory(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/sticker/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    return res.ok
  } catch {
    return false
  }
}

// Pinned posts
export interface PinnedPostData {
  eventId: string | null
  createdAt?: number
}

export async function fetchPinnedPost(pubkey: string): Promise<PinnedPostData> {
  try {
    const res = await fetch(`${API_BASE}/api/pins/${pubkey}`)
    if (!res.ok) return { eventId: null }
    return res.json()
  } catch {
    return { eventId: null }
  }
}

export async function setPinnedPost(pubkey: string, eventId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/pins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, eventId }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function unpinPost(pubkey: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/pins/${pubkey}`, {
      method: 'DELETE',
    })
    return res.ok
  } catch {
    return false
  }
}

// User serial (participation order)
export interface UserSerialData {
  serial: number | null
  firstPostAt?: number
  visible?: boolean
}

export async function fetchUserSerial(pubkey: string): Promise<UserSerialData> {
  try {
    const res = await fetch(`${API_BASE}/api/serial/${pubkey}`)
    if (!res.ok) return { serial: null }
    return res.json()
  } catch {
    return { serial: null }
  }
}

// Upload history
export interface UploadHistoryItem {
  url: string
  filename: string
  type: 'image' | 'video' | 'audio'
  uploadedAt: number
}

export async function fetchUploadHistory(pubkey: string): Promise<UploadHistoryItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/uploads/${pubkey}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.uploads || []
  } catch {
    return []
  }
}

export async function saveUploadToHistory(
  pubkey: string,
  url: string,
  filename: string,
  type: 'image' | 'video' | 'audio'
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, url, filename, type }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function deleteUploadFromHistory(pubkey: string, url: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/uploads`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, url }),
    })
    return res.ok
  } catch {
    return false
  }
}
