// Navigation utilities
import { nip19 } from 'nostr-tools'
import type { FilterMode, SearchFilters } from '../../../types'
import { getNavigateFunction } from './router-navigation'
import { STORAGE_KEYS } from '../../constants'

// Navigate to a URL using React Router
export function navigateTo(href: string): void {
  const navigate = getNavigateFunction()
  navigate(href)
}

export function navigateToHome(): void {
  navigateTo('/')
}

export function navigateToPost(eventId: string): void {
  navigateTo(`/post/${eventId}`)
}

export function navigateToUser(pubkey: string): void {
  // Convert hex to npub if needed
  const id = pubkey.startsWith('npub1') ? pubkey : nip19.npubEncode(pubkey)
  navigateTo(`/user/${id}`)
}

export function navigateToTag(tag: string): void {
  navigateTo(`/tag/${encodeURIComponent(tag)}`)
}

export function navigateToEdit(eventId: string): void {
  navigateTo(`/?edit=${eventId}`)
}

export function navigateToReply(eventId: string): void {
  navigateTo(`/?reply=${eventId}`)
}

// Build tag filter URL
export function buildTagUrl(tags: string[], mode: FilterMode): string {
  if (tags.length === 0) return '/'
  const separator = mode === 'and' ? '+' : ','
  return `/tag/${tags.map((t) => encodeURIComponent(t)).join(separator)}`
}

export function navigateToTagFilter(tags: string[], mode: FilterMode): void {
  navigateTo(buildTagUrl(tags, mode))
}

// Add tag to current filter and navigate
export function navigateToAddTag(currentTags: string[], newTag: string, mode: FilterMode): void {
  if (currentTags.includes(newTag)) return
  navigateToTagFilter([...currentTags, newTag], mode)
}

// Default search filters
export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  query: '',
  ngWords: [],
  tags: [],
  ngTags: [],
  mode: 'and',
  showSNS: true,
  showBlog: true,
  mypace: true,
  lang: '',
  // Smart filters default to ON (hide by default)
  hideAds: true,
  hideNSFW: true,
  hideNPC: false, // NPC posts shown by default
}

// Save filters to localStorage
export function saveFiltersToStorage(filters: SearchFilters): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SEARCH_FILTERS, JSON.stringify(filters))
  } catch {
    // Ignore storage errors
  }
}

// Load filters from localStorage
export function loadFiltersFromStorage(): SearchFilters {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SEARCH_FILTERS)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Merge with defaults to ensure all fields exist
      return { ...DEFAULT_SEARCH_FILTERS, ...parsed }
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SEARCH_FILTERS
}

// Build search URL with all filter parameters
export function buildSearchUrl(filters: Partial<SearchFilters>): string {
  const params = new URLSearchParams()
  const f = { ...DEFAULT_SEARCH_FILTERS, ...filters }

  if (f.query) params.set('q', f.query)
  if (f.ngWords.length > 0) params.set('ng', f.ngWords.join(','))
  if (f.tags.length > 0) {
    const separator = f.mode === 'and' ? '+' : ','
    params.set('tags', f.tags.join(separator))
  }
  if (f.ngTags.length > 0) {
    params.set('ngtags', f.ngTags.join(','))
  }
  if (!f.showSNS) params.set('sns', 'off')
  if (!f.showBlog) params.set('blog', 'off')
  if (!f.mypace) params.set('mypace', 'off')
  if (f.lang) params.set('lang', f.lang)
  // Smart filters: only add param when OFF (default is ON)
  if (!f.hideAds) params.set('ads', 'show')
  if (!f.hideNSFW) params.set('nsfw', 'show')
  // NPC filter: only add param when ON (default is OFF)
  if (f.hideNPC) params.set('npc', 'hide')

  const queryString = params.toString()
  return queryString ? `/?${queryString}` : '/'
}

// Parse search URL parameters to filters
export function parseSearchParams(searchParams: URLSearchParams): SearchFilters {
  const query = searchParams.get('q') || ''
  const ngParam = searchParams.get('ng') || ''
  const ngWords = ngParam
    ? ngParam
        .split(/[\s,]+/)
        .map((w) => w.trim())
        .filter(Boolean)
    : []
  const tagsParam = searchParams.get('tags') || ''
  const ngTagsParam = searchParams.get('ngtags') || ''
  const snsParam = searchParams.get('sns')
  const blogParam = searchParams.get('blog')
  const mypaceParam = searchParams.get('mypace')
  const lang = searchParams.get('lang') || ''
  const adsParam = searchParams.get('ads')
  const nsfwParam = searchParams.get('nsfw')
  const npcParam = searchParams.get('npc')

  // Determine mode and parse tags based on separator
  // + means AND mode, space/comma means OR mode
  let tags: string[] = []
  let mode: FilterMode = 'and'
  if (tagsParam) {
    if (tagsParam.includes('+')) {
      tags = tagsParam
        .split('+')
        .map((t) => decodeURIComponent(t.trim()))
        .filter(Boolean)
      mode = 'and'
    } else {
      // Split by space or comma (OR mode)
      tags = tagsParam
        .split(/[\s,]+/)
        .map((t) => decodeURIComponent(t.trim()))
        .filter(Boolean)
      mode = 'or'
    }
  }

  // Parse NG tags (whitespace or comma separated)
  const ngTags = ngTagsParam
    ? ngTagsParam
        .split(/[\s,]+/)
        .map((t) => decodeURIComponent(t.trim()))
        .filter(Boolean)
    : []

  return {
    query,
    ngWords,
    tags,
    ngTags,
    mode,
    showSNS: snsParam !== 'off',
    showBlog: blogParam !== 'off',
    mypace: mypaceParam !== 'off',
    lang,
    // Smart filters: default ON, param 'show' means OFF
    hideAds: adsParam !== 'show',
    hideNSFW: nsfwParam !== 'show',
    // NPC filter: default OFF, param 'hide' means ON
    hideNPC: npcParam === 'hide',
  }
}

export function navigateToSearch(filters: Partial<SearchFilters>): void {
  navigateTo(buildSearchUrl(filters))
}
