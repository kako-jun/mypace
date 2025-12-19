import { Hono } from 'hono'
import type { Bindings, CachedProfile } from '../types'
import { RELAYS } from '../constants'
import { getCachedProfiles, cacheProfile } from '../services/cache'
import { SimplePool } from 'nostr-tools/pool'

const profiles = new Hono<{ Bindings: Bindings }>()

// GET /api/profiles - プロフィール取得
profiles.get('/', async (c) => {
  const pubkeys = c.req.query('pubkeys')?.split(',').filter(Boolean) || []
  if (pubkeys.length === 0) {
    return c.json({ profiles: {} })
  }

  const db = c.env.DB
  const result: Record<string, Omit<CachedProfile, 'pubkey'>> = {}

  // キャッシュから（TTL内のもののみ）
  try {
    const cached = await getCachedProfiles(db, pubkeys)
    for (const [pubkey, profile] of cached) {
      const { pubkey: _, ...rest } = profile
      result[pubkey] = rest
    }
  } catch (e) {
    console.error('Cache read error:', e)
  }

  // TTL切れまたは見つからなかったpubkeysをリレーから取得
  const cachedPubkeys = Object.keys(result)
  const missingPubkeys = pubkeys.filter((pk) => !cachedPubkeys.includes(pk))

  if (missingPubkeys.length > 0) {
    const pool = new SimplePool()

    try {
      const events = await pool.querySync(RELAYS, { kinds: [0], authors: missingPubkeys })

      // Group by pubkey and keep only the most recent event
      const latestEvents = new Map<string, (typeof events)[0]>()
      for (const event of events) {
        const existing = latestEvents.get(event.pubkey)
        if (!existing || event.created_at > existing.created_at) {
          latestEvents.set(event.pubkey, event)
        }
      }

      for (const event of latestEvents.values()) {
        try {
          const profile = JSON.parse(event.content)
          // Extract emoji tags (NIP-30)
          const emojis = event.tags
            .filter((t: string[]) => t[0] === 'emoji' && t[1] && t[2])
            .map((t: string[]) => ({ shortcode: t[1], url: t[2] }))
          result[event.pubkey] = { ...profile, emojis }

          await cacheProfile(db, event.pubkey, profile, emojis)
        } catch (e) {
          console.error('Profile parse error:', e)
        }
      }
    } finally {
      pool.close(RELAYS)
    }
  }

  return c.json({ profiles: result })
})

export default profiles
