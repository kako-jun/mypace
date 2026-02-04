// Timestamp utilities
export const getCurrentTimestamp = (): number => Math.floor(Date.now() / 1000)

// Validation utilities
export const isValidPubkey = (pubkey: unknown): pubkey is string =>
  typeof pubkey === 'string' && pubkey.length === 64 && /^[0-9a-f]+$/i.test(pubkey)

export const isValidEventId = (eventId: unknown): eventId is string =>
  typeof eventId === 'string' && eventId.length === 64 && /^[0-9a-f]+$/i.test(eventId)

// Array utilities
export const uniqueArray = <T>(arr: T[]): T[] => [...new Set(arr)]

// Clamp number to range
export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

// Parse pagination parameter with clamping
export const parsePaginationLimit = (value: string | undefined, defaultLimit: number, maxLimit: number): number =>
  clamp(parseInt(value || String(defaultLimit), 10) || defaultLimit, 1, maxLimit)

export const parsePaginationOffset = (value: string | undefined): number => Math.max(0, parseInt(value || '0', 10) || 0)

// URL utilities for Shared Article Quote

// Parameters to keep during URL normalization (article identifiers)
const URL_KEEP_PARAMS = ['id', 'episode', 'chapter', 'p', 'page', 'v']

/**
 * Normalize URL for deduplication
 * - Force HTTPS
 * - Remove trailing slashes
 * - Remove tracking parameters (utm_*, ref, etc.)
 * - Remove hash
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Force HTTPS
    parsed.protocol = 'https:'
    // Remove trailing slashes
    parsed.pathname = parsed.pathname.replace(/\/+$/, '')
    // Remove tracking params, keep only meaningful ones
    for (const key of [...parsed.searchParams.keys()]) {
      const isKeepParam = URL_KEEP_PARAMS.some((keep) => key === keep || key.startsWith(keep + '_'))
      if (!isKeepParam) {
        parsed.searchParams.delete(key)
      }
    }
    // Remove hash
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Validate URL (http/https only)
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
