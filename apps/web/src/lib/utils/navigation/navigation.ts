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
  navigateTo(`/?tags=${encodeURIComponent(tag)}`)
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
  return `/?tags=${tags.map((t) => encodeURIComponent(t)).join(separator)}`
}

export function navigateToTagFilter(tags: string[], mode: FilterMode): void {
  navigateTo(buildTagUrl(tags, mode))
}

// Add tag to current filter and navigate
export function navigateToAddTag(currentTags: string[], newTag: string, mode: FilterMode): void {
  if (currentTags.includes(newTag)) return
  navigateToTagFilter([...currentTags, newTag], mode)
}

// Supported language codes for smart filter
const SUPPORTED_LANG_CODES = ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de']

// Get default language from browser settings
function getDefaultLanguage(): string {
  if (typeof navigator === 'undefined') return ''
  const browserLang = navigator.language?.slice(0, 2).toLowerCase() || ''
  return SUPPORTED_LANG_CODES.includes(browserLang) ? browserLang : ''
}

// Default search filters
export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  ngWords: [],
  ngTags: [],
  showSNS: true,
  showBlog: true,
  mypace: true,
  lang: '', // Will be set dynamically based on browser language
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
  // First time: use browser language as default
  return { ...DEFAULT_SEARCH_FILTERS, lang: getDefaultLanguage() }
}
