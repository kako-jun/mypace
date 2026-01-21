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
 * Remove all yellow stella (for unlike operation)
 * Colored stella (green, red, blue, purple) are preserved
 */
export function removeYellowStella(counts: StellaCountsByColor): StellaCountsByColor {
  return {
    yellow: 0,
    green: counts.green,
    red: counts.red,
    blue: counts.blue,
    purple: counts.purple,
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

/**
 * Check if only yellow stella exists (no colored stella)
 */
export function hasOnlyYellowStella(counts: StellaCountsByColor): boolean {
  return counts.yellow > 0 && counts.green === 0 && counts.red === 0 && counts.blue === 0 && counts.purple === 0
}
