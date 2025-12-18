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

// Check if event has a fold tag (mypace long post)
export function hasFoldTag(event: Event): boolean {
  return event.tags?.some((t) => t[0] === 'mypace' && t[1] === 'fold') ?? false
}

// Get the folded content from event tags
export function getFoldContent(tags: string[][]): string | undefined {
  return tags.find((t) => t[0] === 'mypace' && t[1] === 'fold')?.[2]
}

// Remove READ MORE link from content (for displaying full post)
export function removeReadMoreLink(content: string): string {
  // Match pattern: "\n\n...READ MORE → https://..." at the end
  return content.replace(/\n\n\.\.\.READ MORE → https?:\/\/[^\s]+$/i, '')
}
