import { Hono } from 'hono'
import { nip19 } from 'nostr-tools'
import type { Bindings } from '../types'
import { getCurrentTimestamp } from '../utils'
import { GENERAL_RELAYS, KIND_MAGAZINE } from '../constants'

const magazine = new Hono<{ Bindings: Bindings }>()

interface MagazineData {
  title: string
  description: string
  image: string
  author: string
  postCount: number
}

// Decode npub to hex pubkey
function decodePubkey(npubOrHex: string): string | null {
  try {
    if (npubOrHex.startsWith('npub1')) {
      const decoded = nip19.decode(npubOrHex)
      if (decoded.type === 'npub') {
        return decoded.data as string
      }
    }
    // Assume it's already a hex pubkey
    if (/^[0-9a-f]{64}$/i.test(npubOrHex)) {
      return npubOrHex.toLowerCase()
    }
  } catch {}
  return null
}

// Fetch magazine from Nostr relays
async function _fetchMagazine(pubkey: string, slug: string): Promise<MagazineData | null> {
  try {
    const filter = {
      kinds: [KIND_MAGAZINE],
      authors: [pubkey],
      '#d': [slug],
    }

    // Use a simple fetch to relay for Kind 30001
    const relayUrl = GENERAL_RELAYS[0].replace('wss://', 'https://').replace('ws://', 'http://')

    const response = await fetch(relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['REQ', 'ogp', filter]),
    })

    if (!response.ok) return null

    // Note: This is a simplified approach. In production, use proper Nostr client.
    // For now, we'll return a fallback structure since direct HTTP to relays may not work.
    // The actual implementation would require WebSocket connection.

    return null
  } catch {
    return null
  }
}

// GET /api/magazine/:npub/:slug/ogp - Get OGP metadata for a magazine
magazine.get('/:npub/:slug/ogp', async (c) => {
  const { npub, slug } = c.req.param()

  const pubkey = decodePubkey(npub)
  if (!pubkey) {
    return c.json({ error: 'Invalid npub' }, 400)
  }

  // Try to get from cache first
  const db = c.env.DB
  const cacheKey = `magazine:${pubkey}:${slug}`

  try {
    const cached = await db
      .prepare(
        'SELECT title, description, image, author, post_count FROM magazine_ogp_cache WHERE cache_key = ? AND expires_at > ?'
      )
      .bind(cacheKey, getCurrentTimestamp())
      .first()

    if (cached) {
      return c.json({
        title: cached.title,
        description: cached.description,
        image: cached.image,
        author: npub,
        postCount: cached.post_count,
      })
    }
  } catch {
    // Cache miss or error, continue to fetch
  }

  // Since direct Nostr relay access via HTTP is complex,
  // return basic info that the client can enhance
  return c.json({
    title: slug.replace(/-/g, ' '),
    description: '',
    image: '',
    author: npub,
    postCount: 0,
  })
})

// POST /api/magazine/views - Record magazine view
magazine.post('/views', async (c) => {
  const { pubkey, slug, viewerPubkey } = await c.req.json<{
    pubkey: string
    slug: string
    viewerPubkey: string
  }>()

  if (!pubkey || !slug) {
    return c.json({ error: 'pubkey and slug are required' }, 400)
  }

  const db = c.env.DB
  const now = getCurrentTimestamp()
  const magazineKey = `${pubkey}:${slug}`

  try {
    // Insert or update view count
    await db
      .prepare(
        `INSERT INTO magazine_views (magazine_key, pubkey, slug, view_count, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT(magazine_key) DO UPDATE SET
           view_count = view_count + 1,
           updated_at = ?`
      )
      .bind(magazineKey, pubkey, slug, now, now, now)
      .run()

    // Record unique viewer if provided
    if (viewerPubkey) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO magazine_view_users (magazine_key, viewer_pubkey, created_at)
           VALUES (?, ?, ?)`
        )
        .bind(magazineKey, viewerPubkey, now)
        .run()
    }

    return c.json({ success: true })
  } catch (e) {
    console.error('Failed to record magazine view:', e)
    return c.json({ error: 'Failed to record view' }, 500)
  }
})

// GET /api/magazine/:npub/:slug/views - Get magazine view count
magazine.get('/:npub/:slug/views', async (c) => {
  const { npub, slug } = c.req.param()

  const pubkey = decodePubkey(npub)
  if (!pubkey) {
    return c.json({ error: 'Invalid npub' }, 400)
  }

  const db = c.env.DB
  const magazineKey = `${pubkey}:${slug}`

  try {
    const result = await db
      .prepare('SELECT view_count FROM magazine_views WHERE magazine_key = ?')
      .bind(magazineKey)
      .first()

    return c.json({
      viewCount: result?.view_count ?? 0,
    })
  } catch {
    return c.json({ viewCount: 0 })
  }
})

export default magazine
