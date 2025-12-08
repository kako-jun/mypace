// Navigation utilities
import type { FilterMode } from '../../types'

export function navigateToHome(): void {
  window.location.href = '/'
}

export function navigateToPost(eventId: string): void {
  window.location.href = `/post/${eventId}`
}

export function navigateToUser(pubkey: string): void {
  window.location.href = `/user/${pubkey}`
}

export function navigateToTag(tag: string): void {
  window.location.href = `/tag/${encodeURIComponent(tag)}`
}

export function navigateToEdit(eventId: string): void {
  window.location.href = `/?edit=${eventId}`
}

export function navigateToReply(eventId: string): void {
  window.location.href = `/?reply=${eventId}`
}

// Build tag filter URL
export function buildTagUrl(tags: string[], mode: FilterMode): string {
  if (tags.length === 0) return '/'
  const separator = mode === 'and' ? '+' : ','
  return `/tag/${tags.map((t) => encodeURIComponent(t)).join(separator)}`
}

export function navigateToTagFilter(tags: string[], mode: FilterMode): void {
  window.location.href = buildTagUrl(tags, mode)
}

// Add tag to current filter and navigate
export function navigateToAddTag(currentTags: string[], newTag: string, mode: FilterMode): void {
  if (currentTags.includes(newTag)) return
  navigateToTagFilter([...currentTags, newTag], mode)
}

// Build search URL with query, tags, and mode
export function buildSearchUrl(query: string, tags: string[], mode: FilterMode): string {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (tags.length > 0) {
    const separator = mode === 'and' ? '+' : ','
    params.set('tags', tags.map((t) => encodeURIComponent(t)).join(separator))
  }
  if (mode === 'or') params.set('mode', 'or')
  const queryString = params.toString()
  return queryString ? `/search?${queryString}` : '/search'
}

export function navigateToSearch(query: string, tags: string[], mode: FilterMode): void {
  window.location.href = buildSearchUrl(query, tags, mode)
}
