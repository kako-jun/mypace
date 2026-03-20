import { Hono } from 'hono'
import type { Bindings } from '../types'

const sitemap = new Hono<{ Bindings: Bindings }>()

// GET /api/sitemap/events - Return all event IDs for sitemap generation
sitemap.get('/events', async (c) => {
  const db = c.env.DB

  const result = await db
    .prepare(`SELECT event_id, created_at FROM sitemap_events ORDER BY created_at DESC LIMIT 50000`)
    .all<{ event_id: string; created_at: number }>()

  return c.json({
    events: result.results || [],
  })
})

export default sitemap
