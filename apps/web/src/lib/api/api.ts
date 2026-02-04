// API client for mypace backend
import type { Event, Profile, ReactionData, ReplyData, RepostData, OgpData } from '../../types'

export const API_BASE =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://api.mypace.llll-ll.com' : 'http://localhost:8787')

// Re-export types for convenience
export type { Event, Profile, ReactionData, ReplyData, RepostData, OgpData }

// Record event to D1 (stella, serial, etc.) - fire-and-forget
export function recordEvent(event: Event): void {
  fetch(`${API_BASE}/api/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  }).catch((e) => {
    console.error('Failed to record event:', e)
  })
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
  wikidataDescription?: string,
  clearWikidata?: boolean
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/super-mention/paths`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path,
      wikidataId,
      wikidataLabel,
      wikidataDescription,
      clearWikidata,
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
  type: 'image' | 'audio'
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
  type: 'image' | 'audio'
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

// View counts type (used by metadata API)
export interface ViewCountData {
  impression: number
  detail: number
}

// ==================== BATCH APIs ====================

// Batch fetch views and super-mentions from D1 (metadata/profiles are fetched directly from Nostr relays)
export interface ViewsAndSuperMentionsResponse {
  views: Record<string, ViewCountData>
  superMentions: Record<string, string>
}

export async function fetchViewsAndSuperMentions(
  eventIds: string[],
  superMentionPaths: string[] = []
): Promise<ViewsAndSuperMentionsResponse> {
  if (eventIds.length === 0 && superMentionPaths.length === 0) {
    return { views: {}, superMentions: {} }
  }

  try {
    const res = await fetch(`${API_BASE}/api/events/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventIds, superMentionPaths }),
    })
    if (!res.ok) return { views: {}, superMentions: {} }
    return res.json()
  } catch {
    return { views: {}, superMentions: {} }
  }
}

// Fetch OGP data for multiple URLs
export async function fetchOgpByUrls(urls: string[]): Promise<Record<string, OgpData>> {
  if (urls.length === 0) return {}

  try {
    const res = await fetch(`${API_BASE}/api/ogp/by-urls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    })
    if (!res.ok) return {}
    return res.json()
  } catch {
    return {}
  }
}

// Stella color types
export interface StellaByColor {
  yellow: number
  green: number
  red: number
  blue: number
  purple: number
}

// Fetch all user stats in one call
export interface UserStats {
  postsCount: number | null
  stellaCount: number
  stellaByColor: StellaByColor
  givenStellaCount: number
  givenStellaByColor: StellaByColor
  viewsCount: {
    details: number
    impressions: number
  }
}

export async function fetchUserStats(pubkey: string): Promise<UserStats | null> {
  try {
    const res = await fetch(`${API_BASE}/api/user/${pubkey}/stats`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// Record views (new unified API)
export async function recordImpressions(
  events: Array<{ eventId: string; authorPubkey: string }>,
  type: 'impression' | 'detail',
  viewerPubkey: string
): Promise<boolean> {
  if (events.length === 0) return true

  try {
    const res = await fetch(`${API_BASE}/api/views/impressions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events, type, viewerPubkey }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ==================== NOTIFICATIONS ====================

export interface NotificationActor {
  pubkey: string
  stellaByColor?: Partial<StellaByColor>
}

export interface AggregatedNotification {
  ids: number[]
  type: 'stella' | 'reply' | 'repost'
  targetEventId: string
  sourceEventId: string | null
  actors: NotificationActor[]
  createdAt: number
  readAt: number | null
}

export interface NotificationsResponse {
  notifications: AggregatedNotification[]
  hasUnread: boolean
}

// Fetch notifications for a user
export async function fetchNotifications(pubkey: string): Promise<NotificationsResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/notifications?pubkey=${pubkey}`)
    if (!res.ok) return { notifications: [], hasUnread: false }
    return res.json()
  } catch {
    return { notifications: [], hasUnread: false }
  }
}

// Check if user has unread notifications
export async function checkUnreadNotifications(pubkey: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/notifications/unread-count?pubkey=${pubkey}`)
    if (!res.ok) return false
    const data = await res.json()
    return data.hasUnread ?? false
  } catch {
    return false
  }
}

// Mark notifications as read
export async function markNotificationsRead(ids: number[]): Promise<boolean> {
  if (ids.length === 0) return true

  try {
    const res = await fetch(`${API_BASE}/api/notifications/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ==================== STELLA BALANCE ====================

export interface StellaBalance {
  yellow: number
  green: number
  red: number
  blue: number
  purple: number
}

export interface StellaBalanceResponse {
  pubkey: string
  balance: StellaBalance
  updatedAt: number | null
}

// Fetch user's stella balance
export async function fetchStellaBalance(pubkey: string): Promise<StellaBalanceResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/stella-balance/${pubkey}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// Send stella (decrease sender's balance)
export async function sendStella(
  senderPubkey: string,
  amounts: Partial<StellaBalance>
): Promise<{ success: boolean; newBalance?: StellaBalance; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/stella-balance/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderPubkey, amounts }),
    })
    return res.json()
  } catch {
    return { success: false, error: 'Network error' }
  }
}

// ==================== SUPERNOVAS ====================

export interface SupernovaDefinition {
  id: string
  name: string
  description: string
  category: 'single' | 'cumulative'
  threshold: number
  supernova_color: string
  reward_green: number
  reward_red: number
  reward_blue: number
  reward_purple: number
}

export interface UserSupernova extends SupernovaDefinition {
  unlocked_at: number
}

// Fetch all supernova definitions
export async function fetchSupernovaDefinitions(): Promise<SupernovaDefinition[]> {
  try {
    const res = await fetch(`${API_BASE}/api/supernovas/definitions`)
    if (!res.ok) return []
    const data = await res.json()
    return data.supernovas || []
  } catch {
    return []
  }
}

// Fetch user's unlocked supernovas
export async function fetchUserSupernovas(pubkey: string): Promise<UserSupernova[]> {
  try {
    const res = await fetch(`${API_BASE}/api/supernovas/${pubkey}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.unlocked || []
  } catch {
    return []
  }
}

// User stella stats for progress display
export interface UserStellaStats {
  pubkey: string
  received: Record<string, number>
  given: Record<string, number>
}

// Fetch user's stella stats for progress display
export async function fetchUserStellaStats(pubkey: string): Promise<UserStellaStats | null> {
  try {
    const res = await fetch(`${API_BASE}/api/supernovas/stats/${pubkey}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// Check and unlock supernovas for a user
export async function checkSupernovas(
  pubkey: string,
  event?: string
): Promise<{ success: boolean; newlyUnlocked: UserSupernova[]; totalUnlocked: number }> {
  try {
    const res = await fetch(`${API_BASE}/api/supernovas/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, event }),
    })
    if (!res.ok) return { success: false, newlyUnlocked: [], totalUnlocked: 0 }
    return res.json()
  } catch {
    return { success: false, newlyUnlocked: [], totalUnlocked: 0 }
  }
}

// ==================== WORDROT ====================

export interface WordrotWord {
  id: number
  text: string
  image_url: string | null
  image_status: 'pending' | 'generating' | 'done' | 'failed'
  discovered_by: string | null
  discovered_at: number
  discovery_count: number
  synthesis_count: number
}

export interface UserWordrotWord {
  word: WordrotWord
  count: number
  first_collected_at: number
  last_collected_at: number
  source: 'harvest' | 'synthesis'
}

export interface WordrotSynthesis {
  word_a: string
  word_b: string
  word_c: string
  result?: string
  use_count: number
}

// Extract nouns from post content
export async function extractNouns(eventId: string, content: string): Promise<{ words: string[]; cached: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/wordrot/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, content }),
    })
    if (!res.ok) return { words: [], cached: false }
    return res.json()
  } catch {
    return { words: [], cached: false }
  }
}

// Collect a word from a post
export async function collectWord(
  pubkey: string,
  word: string,
  eventId?: string
): Promise<{
  word: WordrotWord | null
  isNew: boolean
  isFirstEver: boolean
  count: number
}> {
  try {
    const res = await fetch(`${API_BASE}/api/wordrot/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, word, eventId }),
    })
    if (!res.ok) return { word: null, isNew: false, isFirstEver: false, count: 0 }
    return res.json()
  } catch {
    return { word: null, isNew: false, isFirstEver: false, count: 0 }
  }
}

// Synthesize words
export async function synthesizeWords(
  pubkey: string,
  wordA: string,
  wordB: string,
  wordC: string
): Promise<{
  result: WordrotWord | null
  isNewSynthesis: boolean
  isNewWord: boolean
  formula: string
  error?: string
}> {
  try {
    const res = await fetch(`${API_BASE}/api/wordrot/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey, wordA, wordB, wordC }),
    })
    const data = await res.json()
    if (data.error && !data.result) {
      return { result: null, isNewSynthesis: false, isNewWord: false, formula: '', error: data.error }
    }
    return data
  } catch {
    return { result: null, isNewSynthesis: false, isNewWord: false, formula: '', error: 'Network error' }
  }
}

// Get user's word inventory
export async function fetchWordrotInventory(pubkey: string): Promise<{
  words: UserWordrotWord[]
  totalCount: number
  uniqueCount: number
}> {
  try {
    const res = await fetch(`${API_BASE}/api/wordrot/inventory/${pubkey}`)
    if (!res.ok) return { words: [], totalCount: 0, uniqueCount: 0 }
    return res.json()
  } catch {
    return { words: [], totalCount: 0, uniqueCount: 0 }
  }
}

// Get word details
export async function fetchWordDetails(text: string): Promise<{
  word: WordrotWord | null
  synthesesAsResult: WordrotSynthesis[]
  synthesesAsInput: WordrotSynthesis[]
}> {
  try {
    const res = await fetch(`${API_BASE}/api/wordrot/word/${encodeURIComponent(text)}`)
    if (!res.ok) return { word: null, synthesesAsResult: [], synthesesAsInput: [] }
    return res.json()
  } catch {
    return { word: null, synthesesAsResult: [], synthesesAsInput: [] }
  }
}

// Get leaderboard
export async function fetchWordrotLeaderboard(): Promise<{
  topDiscoverers: Array<{ pubkey: string; count: number }>
  popularWords: Array<{ text: string; image_url: string | null; discovery_count: number; synthesis_count: number }>
  recentWords: Array<{ text: string; image_url: string | null; discovered_by: string | null; discovered_at: number }>
}> {
  try {
    const res = await fetch(`${API_BASE}/api/wordrot/leaderboard`)
    if (!res.ok) return { topDiscoverers: [], popularWords: [], recentWords: [] }
    return res.json()
  } catch {
    return { topDiscoverers: [], popularWords: [], recentWords: [] }
  }
}
