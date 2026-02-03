import { Hono } from 'hono'
import { SimplePool } from 'nostr-tools/pool'
import type { Bindings } from '../types'
import { ALL_RELAYS, TIMEOUT_MS_RELAY } from '../constants'

const profiles = new Hono<{ Bindings: Bindings }>()

// GET /api/profiles - プロフィール取得（OGP用）
profiles.get('/', async (c) => {
  const pubkeys =
    c.req
      .query('pubkeys')
      ?.split(',')
      .filter((pk) => pk.length === 64) || []

  if (pubkeys.length === 0) {
    return c.json({ profiles: {} })
  }

  // Limit to prevent abuse
  const limitedPubkeys = pubkeys.slice(0, 10)
  const relayCount = c.env.RELAY_COUNT !== undefined ? parseInt(c.env.RELAY_COUNT, 10) : ALL_RELAYS.length
  const RELAYS = ALL_RELAYS.slice(0, Math.max(1, relayCount))

  const pool = new SimplePool()
  try {
    const events = await Promise.race([
      pool.querySync(RELAYS, { kinds: [0], authors: limitedPubkeys }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS_RELAY)),
    ])

    // Group by pubkey and keep only the most recent event
    const latestEvents = new Map<string, (typeof events)[0]>()
    for (const event of events) {
      const existing = latestEvents.get(event.pubkey)
      if (!existing || event.created_at > existing.created_at) {
        latestEvents.set(event.pubkey, event)
      }
    }

    // Parse profile content
    const result: Record<string, { name?: string; display_name?: string; picture?: string }> = {}
    for (const event of latestEvents.values()) {
      try {
        const profile = JSON.parse(event.content)
        result[event.pubkey] = {
          name: profile.name,
          display_name: profile.display_name,
          picture: profile.picture,
        }
      } catch {
        // Skip invalid JSON
      }
    }

    return c.json({ profiles: result })
  } catch (error) {
    console.error('Error fetching profiles:', error)
    return c.json({ profiles: {} })
  } finally {
    pool.close(RELAYS)
  }
})

export default profiles
