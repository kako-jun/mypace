// Navigation utilities
import { nip19 } from 'nostr-tools'
import type { FilterMode } from '../../../types'
import { getNavigateFunction } from './router-navigation'
import { getFilterSettings, setFilterSettings, DEFAULT_SEARCH_FILTERS } from '../../storage'

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

// Re-export storage functions for backwards compatibility
export const loadFiltersFromStorage = getFilterSettings
export const saveFiltersToStorage = setFilterSettings
export { DEFAULT_SEARCH_FILTERS }
