/**
 * Stella utility functions
 * Shared logic for stella operations used by useTimeline and PostView
 */

import type { StellaCountsByColor, StellaColor } from '../nostr/events'
import { MAX_STELLA_PER_USER, EMPTY_STELLA_COUNTS, getTotalStellaCount } from '../nostr/events'

// Re-export for convenience
export { MAX_STELLA_PER_USER, EMPTY_STELLA_COUNTS, getTotalStellaCount }
export type { StellaCountsByColor, StellaColor }

/**
 * Check if user can add more stella to a post
 */
export function canAddStella(currentMyStella: StellaCountsByColor, pendingStella: StellaCountsByColor): boolean {
  const currentTotal = getTotalStellaCount(currentMyStella)
  const pendingTotal = getTotalStellaCount(pendingStella)
  return currentTotal + pendingTotal < MAX_STELLA_PER_USER
}

/**
 * Add one stella of specified color to counts
 */
export function addStellaToColor(counts: StellaCountsByColor, color: StellaColor): StellaCountsByColor {
  return {
    ...counts,
    [color]: counts[color] + 1,
  }
}

/**
 * Remove all stella of a specific color
 */
export function removeStellaColor(counts: StellaCountsByColor, color: StellaColor): StellaCountsByColor {
  return {
    ...counts,
    [color]: 0,
  }
}

/**
 * Create empty stella counts object
 */
export function createEmptyStellaCounts(): StellaCountsByColor {
  return { ...EMPTY_STELLA_COUNTS }
}

/**
 * Check if user has any stella on this post
 */
export function hasAnyStella(counts: StellaCountsByColor): boolean {
  return getTotalStellaCount(counts) > 0
}
