import { Hono } from 'hono'
import type { Bindings } from '../types'

const views = new Hono<{ Bindings: Bindings }>()

// POST /api/views/batch - 複数投稿の閲覧数を一括取得
// NOTE: Static routes must come before dynamic routes (/:eventId)
views.post('/batch', async (c) => {
  const { eventIds } = await c.req.json<{ eventIds: string[] }>()

  if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
    return c.json({ error: 'eventIds array is required' }, 400)
  }

  // Limit batch size to prevent abuse
  const limitedIds = eventIds.slice(0, 100)
  const placeholders = limitedIds.map(() => '?').join(',')

  const rows = await c.env.DB.prepare(
    `
    SELECT event_id, view_type, COUNT(*) as count
    FROM event_views
    WHERE event_id IN (${placeholders})
    GROUP BY event_id, view_type
  `
  )
    .bind(...limitedIds)
    .all()

  // Initialize all event IDs with zero counts
  const result: Record<string, { impression: number; detail: number }> = {}
  for (const id of limitedIds) {
    result[id] = { impression: 0, detail: 0 }
  }

  // Fill in actual counts
  for (const row of rows.results) {
    const eventId = row.event_id as string
    const viewType = row.view_type as 'impression' | 'detail'
    if (result[eventId]) {
      result[eventId][viewType] = row.count as number
    }
  }

  return c.json(result)
})

// POST /api/views/batch-record - 複数投稿の閲覧を一括記録
views.post('/batch-record', async (c) => {
  const { events, viewType, viewerPubkey } = await c.req.json<{
    events: Array<{ eventId: string; authorPubkey: string }>
    viewType: 'impression' | 'detail'
    viewerPubkey: string
  }>()

  if (!events || !Array.isArray(events) || events.length === 0) {
    return c.json({ error: 'events array is required' }, 400)
  }

  if (!viewType || !viewerPubkey) {
    return c.json({ error: 'viewType and viewerPubkey are required' }, 400)
  }

  if (viewType !== 'impression' && viewType !== 'detail') {
    return c.json({ error: 'viewType must be "impression" or "detail"' }, 400)
  }

  // Limit batch size to prevent abuse
  const limitedEvents = events.slice(0, 100)
  const now = Math.floor(Date.now() / 1000)

  // Use batch insert with ON CONFLICT DO NOTHING
  const stmt = c.env.DB.prepare(
    `INSERT INTO event_views (event_id, author_pubkey, viewer_pubkey, view_type, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (event_id, viewer_pubkey, view_type) DO NOTHING`
  )

  const batch = limitedEvents.map((e) => stmt.bind(e.eventId, e.authorPubkey, viewerPubkey, viewType, now))

  await c.env.DB.batch(batch)

  return c.json({
    success: true,
    recorded: limitedEvents.length,
  })
})

// POST /api/views/:eventId - 閲覧を記録
views.post('/:eventId', async (c) => {
  const eventId = c.req.param('eventId')
  const { viewType, viewerPubkey, authorPubkey } = await c.req.json<{
    viewType: 'impression' | 'detail'
    viewerPubkey: string
    authorPubkey: string
  }>()

  if (!viewType || !viewerPubkey || !authorPubkey) {
    return c.json({ error: 'viewType, viewerPubkey and authorPubkey are required' }, 400)
  }

  if (viewType !== 'impression' && viewType !== 'detail') {
    return c.json({ error: 'viewType must be "impression" or "detail"' }, 400)
  }

  const now = Math.floor(Date.now() / 1000)

  const result = await c.env.DB.prepare(
    `
    INSERT INTO event_views (event_id, author_pubkey, viewer_pubkey, view_type, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (event_id, viewer_pubkey, view_type) DO NOTHING
  `
  )
    .bind(eventId, authorPubkey, viewerPubkey, viewType, now)
    .run()

  return c.json({
    success: true,
    isNew: result.meta.changes > 0,
  })
})

// GET /api/views/:eventId - 閲覧数を取得
views.get('/:eventId', async (c) => {
  const eventId = c.req.param('eventId')

  const rows = await c.env.DB.prepare(
    `
    SELECT view_type, COUNT(*) as count
    FROM event_views
    WHERE event_id = ?
    GROUP BY view_type
  `
  )
    .bind(eventId)
    .all()

  const counts = { impression: 0, detail: 0 }
  for (const row of rows.results) {
    const viewType = row.view_type as 'impression' | 'detail'
    counts[viewType] = row.count as number
  }

  return c.json(counts)
})

export default views
