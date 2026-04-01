import type { Event, StickerQuadrant, StickerLayer } from '../../types'
import { MYPACE_TAG } from './constants'

// Check if event has the mypace tag
export function hasMypaceTag(event: Event): boolean {
  return event.tags?.some((t) => t[0] === 't' && t[1] === MYPACE_TAG) ?? false
}

// Check if event has a teaser tag (long post with hidden content)
export function hasTeaserTag(event: Event): boolean {
  return event.tags?.some((t) => t[0] === 'teaser') ?? false
}

// Get the teaser content from event tags
export function getTeaserContent(tags: string[][]): string | undefined {
  return tags.find((t) => t[0] === 'teaser')?.[1]
}

// Get the teaser required color from event tags (third element)
export function getTeaserColor(tags: string[][]): string | undefined {
  return tags.find((t) => t[0] === 'teaser')?.[2]
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

// Extract unique locations from tags, deduplicating hierarchical geohashes
// NIP-52 specifies multiple precision levels for the same location (e.g., xn77h07j, xn77h07, xn77h0)
// We keep only the most precise (longest) geohash for each location
export function extractUniqueLocations(tags: string[][]): Array<{ geohash: string; name?: string }> {
  const gTags = tags.filter((tag) => tag[0] === 'g')
  const locationTags = tags.filter((tag) => tag[0] === 'location')

  if (gTags.length === 0) return []

  // Sort by geohash length descending (most precise first)
  const sortedGTags = [...gTags].sort((a, b) => (b[1]?.length || 0) - (a[1]?.length || 0))

  const uniqueGeohashes: string[] = []

  for (const gTag of sortedGTags) {
    const geohash = gTag[1]
    if (!geohash) continue

    // Check if this geohash is a prefix of any already-added geohash
    const isPrefix = uniqueGeohashes.some((existing) => existing.startsWith(geohash))
    if (!isPrefix) {
      uniqueGeohashes.push(geohash)
    }
  }

  // Map to locations with names (use the first location tag if available)
  return uniqueGeohashes.map((geohash, i) => ({
    geohash,
    name: locationTags[i]?.[1],
  }))
}

// Parse sticker tags from event
// Format: ["sticker", "<url>", "<x>", "<y>", "<size>", "<rotation>", "<quadrant>", "<layer>"]
export function parseStickers(tags: string[][]): Array<{
  url: string
  x: number
  y: number
  size: number
  rotation: number
  quadrant: StickerQuadrant
  layer?: StickerLayer
}> {
  const validQuadrants: StickerQuadrant[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
  const validLayers: StickerLayer[] = ['front', 'back']
  return tags
    .filter((t) => t[0] === 'sticker' && t.length >= 5)
    .map((t) => ({
      url: t[1],
      x: Math.max(0, Math.min(100, parseInt(t[2], 10) || 0)),
      y: Math.max(0, Math.min(100, parseInt(t[3], 10) || 0)),
      size: Math.max(5, Math.min(100, parseInt(t[4], 10) || 15)),
      rotation: t[5] ? Math.max(0, Math.min(360, parseInt(t[5], 10) || 0)) : 0,
      quadrant: (t[6] && validQuadrants.includes(t[6] as StickerQuadrant) ? t[6] : 'top-left') as StickerQuadrant,
      layer: (t[7] && validLayers.includes(t[7] as StickerLayer) ? t[7] : undefined) as StickerLayer | undefined,
    }))
    .filter((s) => s.url)
}
