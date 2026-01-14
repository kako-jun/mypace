import { Hono } from 'hono'
import type { Bindings } from '../types'
import type { D1Database } from '@cloudflare/workers-types'
import { queryRelays } from '../services/relay'

const admin = new Hono<{ Bindings: Bindings }>()

// Batch insert stella records
async function batchInsertStella(
  db: D1Database,
  records: Array<{
    eventId: string
    authorPubkey: string
    reactorPubkey: string
    stellaCount: number
    reactionId: string
  }>
): Promise<number> {
  if (records.length === 0) return 0

  let inserted = 0
  // Process in batches of 100 to avoid D1 limits
  const batchSize = 100
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const stmt = db.prepare(
      `INSERT INTO user_stella (event_id, author_pubkey, reactor_pubkey, stella_count, reaction_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (event_id, reactor_pubkey) DO UPDATE SET
         stella_count = excluded.stella_count,
         reaction_id = excluded.reaction_id,
         updated_at = excluded.updated_at`
    )

    const now = Math.floor(Date.now() / 1000)
    const batchResults = await db.batch(
      batch.map((r) => stmt.bind(r.eventId, r.authorPubkey, r.reactorPubkey, r.stellaCount, r.reactionId, now))
    )
    inserted += batchResults.filter((r) => r.success).length
  }

  return inserted
}

// POST /api/admin/backfill-stella - Backfill stella records from relays
admin.post('/backfill-stella', async (c) => {
  const clearFirst = c.req.query('clear') === 'true'
  const db = c.env.DB

  try {
    // Clear existing records if requested
    if (clearFirst) {
      await db.prepare('DELETE FROM user_stella').run()
    }

    // Fetch all Kind 7 reactions from relays
    const reactions = await queryRelays({
      kinds: [7],
      limit: 10000,
    })

    // Filter reactions with stella tag and extract data
    const stellaRecords: Array<{
      eventId: string
      authorPubkey: string
      reactorPubkey: string
      stellaCount: number
      reactionId: string
    }> = []

    for (const reaction of reactions) {
      const tags = reaction.tags || []

      // Check for stella tag
      const stellaTag = tags.find((t: string[]) => t[0] === 'stella')
      if (!stellaTag || !stellaTag[1]) continue

      const stellaCount = parseInt(stellaTag[1], 10)
      if (isNaN(stellaCount) || stellaCount < 1 || stellaCount > 10) continue

      // Get target event ID and author pubkey
      const eTag = tags.find((t: string[]) => t[0] === 'e')
      const pTag = tags.find((t: string[]) => t[0] === 'p')
      if (!eTag || !eTag[1] || !pTag || !pTag[1]) continue

      stellaRecords.push({
        eventId: eTag[1],
        authorPubkey: pTag[1],
        reactorPubkey: reaction.pubkey,
        stellaCount,
        reactionId: reaction.id,
      })
    }

    // Batch insert
    const inserted = await batchInsertStella(db, stellaRecords)

    return c.json({
      success: true,
      cleared: clearFirst,
      totalReactions: reactions.length,
      stellaReactions: stellaRecords.length,
      inserted,
    })
  } catch (e) {
    console.error('Backfill stella error:', e)
    return c.json({ success: false, error: String(e) }, 500)
  }
})

export default admin
