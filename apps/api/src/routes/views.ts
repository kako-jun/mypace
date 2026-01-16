import { Hono } from 'hono'
import type { Bindings } from '../types'

const views = new Hono<{ Bindings: Bindings }>()

// POST /api/views/record - 閲覧一括記録
views.post('/record', async (c) => {
  const { events, type, viewerPubkey } = await c.req.json<{
    events: Array<{ eventId: string; authorPubkey: string }>
    type: 'impression' | 'detail'
    viewerPubkey: string
  }>()

  if (!events || !Array.isArray(events) || events.length === 0) {
    return c.json({ error: 'events array is required' }, 400)
  }

  if (!type || !viewerPubkey) {
    return c.json({ error: 'type and viewerPubkey are required' }, 400)
  }

  if (type !== 'impression' && type !== 'detail') {
    return c.json({ error: 'type must be "impression" or "detail"' }, 400)
  }

  // Limit batch size
  const limitedEvents = events.slice(0, 100)
  const now = Math.floor(Date.now() / 1000)

  const stmt = c.env.DB.prepare(
    `INSERT INTO event_views (event_id, author_pubkey, viewer_pubkey, view_type, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (event_id, viewer_pubkey, view_type) DO NOTHING`
  )

  const batch = limitedEvents.map((e) => stmt.bind(e.eventId, e.authorPubkey, viewerPubkey, type, now))

  await c.env.DB.batch(batch)

  return c.json({
    success: true,
    recorded: limitedEvents.length,
  })
})

export default views
