import { Hono } from 'hono'
import type { Bindings } from '../types'
import { ALL_RELAYS, MYPACE_TAG } from '../constants'

const sitemap = new Hono<{ Bindings: Bindings }>()

// GET /api/sitemap/events - Return all event IDs for sitemap generation
sitemap.get('/events', async (c) => {
  const db = c.env.DB

  const result = await db
    .prepare(`SELECT event_id, created_at FROM sitemap_events ORDER BY created_at DESC`)
    .all<{ event_id: string; created_at: number }>()

  return c.json({
    events: result.results || [],
  })
})

// POST /api/sitemap/backfill - One-time backfill from Nostr relays
// Fetches all mypace-tagged kind:1 events and records them in sitemap_events
sitemap.post('/backfill', async (c) => {
  const db = c.env.DB

  // Import nostr-tools dynamically for relay queries
  const { SimplePool } = await import('nostr-tools/pool')
  const pool = new SimplePool()

  try {
    const relays = ALL_RELAYS.slice(0, 3)
    const events = await pool.querySync(relays, {
      kinds: [1],
      '#t': [MYPACE_TAG],
      limit: 5000,
    })

    let inserted = 0
    // Batch insert using D1 batch
    const statements = events.map((event) =>
      db
        .prepare(`INSERT OR IGNORE INTO sitemap_events (event_id, pubkey, created_at) VALUES (?, ?, ?)`)
        .bind(event.id, event.pubkey, event.created_at)
    )

    // D1 batch supports up to 500 statements at a time
    for (let i = 0; i < statements.length; i += 500) {
      const batch = statements.slice(i, i + 500)
      const results = await db.batch(batch)
      inserted += results.filter((r) => r.meta.changes > 0).length
    }

    pool.close(relays)

    return c.json({
      success: true,
      fetched: events.length,
      inserted,
    })
  } catch (e) {
    return c.json({ error: `Backfill failed: ${e instanceof Error ? e.message : 'Unknown error'}` }, 500)
  }
})

export default sitemap
