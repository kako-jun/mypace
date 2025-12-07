// Navigation utilities
import type { FilterMode } from '../../types'

export function navigateToHome(): void {
  window.location.href = '/'
}

export function navigateToPost(eventId: string): void {
  window.location.href = `/post/${eventId}`
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
