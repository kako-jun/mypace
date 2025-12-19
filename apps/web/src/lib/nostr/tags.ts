import type { Event } from '../../types'
import { MYPACE_TAG } from './constants'

// Get the root event tag from an event's tags
export function getRootEventTag(tags: string[][]): string[] | undefined {
  return tags.find((t) => t[0] === 'e' && t[3] === 'root')
}

// Get the root event ID from an event's tags
export function getRootEventId(tags: string[][]): string | undefined {
  return getRootEventTag(tags)?.[1]
}

// Get the first 'e' tag value (for reactions/reposts)
export function getETagValue(tags: string[][]): string | undefined {
  return tags.find((t) => t[0] === 'e')?.[1]
}

// Get the first 'p' tag value
export function getPTagValue(tags: string[][]): string | undefined {
  return tags.find((t) => t[0] === 'p')?.[1]
}

// Check if event has the mypace tag
export function hasMypaceTag(event: Event): boolean {
  return event.tags?.some((t) => t[0] === 't' && t[1] === MYPACE_TAG) ?? false
}

// Filter replies by root event ID
export function filterRepliesByRoot(replies: Event[], rootEventId: string): Event[] {
  return replies.filter((r) => {
    const rootTag = getRootEventTag(r.tags)
    return rootTag && rootTag[1] === rootEventId
  })
}

// Check if event has a teaser tag (long post with hidden content)
export function hasTeaserTag(event: Event): boolean {
  return event.tags?.some((t) => t[0] === 'teaser') ?? false
}

// Get the teaser content from event tags
export function getTeaserContent(tags: string[][]): string | undefined {
  return tags.find((t) => t[0] === 'teaser')?.[1]
}

// Remove READ MORE link from content (for displaying full post)
export function removeReadMoreLink(content: string): string {
  // Match pattern: "\n\n...READ MORE → https://..." at the end
  return content.replace(/\n\n\.\.\.READ MORE → https?:\/\/[^\s]+$/i, '')
}

// Get full content for editing (combine content + teaser, remove READ MORE link)
export function getFullContentForEdit(event: Event): string {
  if (!hasTeaserTag(event)) {
    return event.content
  }
  // Remove READ MORE link and append teaser content
  const baseContent = removeReadMoreLink(event.content)
  const teaserContent = getTeaserContent(event.tags)
  return teaserContent ? baseContent + teaserContent : baseContent
}

// Check if event has sticker tags
export function hasStickers(event: Event): boolean {
  return event.tags?.some((t) => t[0] === 'sticker') ?? false
}

// Parse sticker tags from event
// Format: ["sticker", "<url>", "<x>", "<y>", "<size>", "<rotation>"]
export function parseStickers(
  tags: string[][]
): Array<{ url: string; x: number; y: number; size: number; rotation: number }> {
  return tags
    .filter((t) => t[0] === 'sticker' && t.length >= 5)
    .map((t) => ({
      url: t[1],
      x: Math.max(0, Math.min(100, parseInt(t[2], 10) || 0)),
      y: Math.max(0, Math.min(100, parseInt(t[3], 10) || 0)),
      size: Math.max(5, Math.min(100, parseInt(t[4], 10) || 15)),
      rotation: t[5] ? Math.max(0, Math.min(360, parseInt(t[5], 10) || 0)) : 0,
    }))
    .filter((s) => s.url)
}
