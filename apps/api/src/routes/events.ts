import { Hono } from 'hono'
import { SimplePool } from 'nostr-tools/pool'
import type { Bindings } from '../types'
import { ALL_RELAYS, TIMEOUT_MS_RELAY } from '../constants'

const events = new Hono<{ Bindings: Bindings }>()

// GET /api/events/:id - 単一イベント取得（OGP用）
events.get('/:id', async (c) => {
  const id = c.req.param('id')
  const relayCount = c.env.RELAY_COUNT !== undefined ? parseInt(c.env.RELAY_COUNT, 10) : ALL_RELAYS.length
  const RELAYS = ALL_RELAYS.slice(0, Math.max(1, relayCount))

  const pool = new SimplePool()
  try {
    const events = await Promise.race([
      pool.querySync(RELAYS, { ids: [id] }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS_RELAY)),
    ])

    if (events.length > 0) {
      return c.json({ event: events[0] })
    }
    return c.json({ error: 'Event not found' }, 404)
  } catch (error) {
    console.error('Error fetching event:', error)
    return c.json({ error: 'Failed to fetch event' }, 500)
  } finally {
    pool.close(RELAYS)
  }
})

// POST /api/events/enrich - views + super-mention一括取得（D1のみ）
// metadata/profiles はブラウザがNostrリレーから直接取得するようになったため、
// このAPIはD1に保存されているviews/superMentionsのみを返す
events.post('/enrich', async (c) => {
  const { eventIds = [], superMentionPaths = [] } = await c.req.json<{
    eventIds?: string[]
    superMentionPaths?: string[]
  }>()

  if (!Array.isArray(eventIds)) {
    return c.json({ error: 'eventIds must be an array' }, 400)
  }

  // Limit batch sizes
  const limitedIds = eventIds.slice(0, 100)
  const limitedPaths = superMentionPaths.slice(0, 200)
  const db = c.env.DB

  // 並列でD1クエリを実行
  const [viewRows, superMentionRows] = await Promise.all([
    // views from D1
    limitedIds.length > 0
      ? db
          .prepare(
            `SELECT event_id, view_type, COUNT(*) as count FROM event_views WHERE event_id IN (${limitedIds.map(() => '?').join(',')}) GROUP BY event_id, view_type`
          )
          .bind(...limitedIds)
          .all()
      : Promise.resolve({ results: [] }),
    // super-mention lookup from D1
    limitedPaths.length > 0
      ? db
          .prepare(
            `SELECT path, wikidata_id FROM super_mention_paths WHERE path IN (${limitedPaths.map(() => '?').join(',')}) AND wikidata_id IS NOT NULL`
          )
          .bind(...limitedPaths)
          .all()
      : Promise.resolve({ results: [] }),
  ])

  // Views結果を構築
  const views: Record<string, { detail: number; impression: number }> = {}
  for (const id of limitedIds) {
    views[id] = { detail: 0, impression: 0 }
  }
  for (const row of viewRows.results || []) {
    const eventId = row.event_id as string
    const viewType = row.view_type as 'impression' | 'detail'
    if (views[eventId]) {
      views[eventId][viewType] = row.count as number
    }
  }

  // Super-mention mapping構築
  const superMentions: Record<string, string> = {}
  for (const row of superMentionRows.results || []) {
    if (row.path && row.wikidata_id) {
      superMentions[row.path as string] = row.wikidata_id as string
    }
  }

  return c.json({ views, superMentions })
})

export default events
