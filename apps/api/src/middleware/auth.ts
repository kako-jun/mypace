// NIP-98 HTTP Auth verification for write endpoints
// Verifies that the caller owns the pubkey they claim by checking a signed Nostr event
import { verifyEvent } from 'nostr-tools'

/**
 * Extract and verify a NIP-98 Authorization header.
 * Returns the authenticated pubkey, or null if verification fails.
 *
 * Expected header: Authorization: Nostr <base64-encoded-event>
 * The event must be kind 27235, with tags [["u", url], ["method", method]],
 * and created_at within 60 seconds of now.
 */
export function verifyNip98Header(authHeader: string | undefined, url: string, method: string): string | null {
  if (!authHeader || !authHeader.startsWith('Nostr ')) return null

  try {
    const eventJson = atob(authHeader.slice(6))
    const event = JSON.parse(eventJson)

    // Verify the event signature
    if (!verifyEvent(event)) return null

    // Must be kind 27235
    if (event.kind !== 27235) return null

    // Check timestamp (within 60 seconds)
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(event.created_at - now) > 60) return null

    // Check URL tag
    const uTag = event.tags.find((t: string[]) => t[0] === 'u')
    if (!uTag || !uTag[1]) return null

    // Normalize URLs for comparison
    try {
      const eventUrl = new URL(uTag[1])
      const requestUrl = new URL(url)
      if (eventUrl.origin !== requestUrl.origin || eventUrl.pathname !== requestUrl.pathname) {
        return null
      }
    } catch {
      return null
    }

    // Check method tag
    const methodTag = event.tags.find((t: string[]) => t[0] === 'method')
    if (!methodTag || methodTag[1]?.toUpperCase() !== method.toUpperCase()) return null

    return event.pubkey
  } catch {
    return null
  }
}
