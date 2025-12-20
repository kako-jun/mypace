import { Hono } from 'hono'
import type { Bindings } from '../types'
import { RELAYS } from '../constants'
import { getCachedEventById } from '../services/cache'
import { SimplePool } from 'nostr-tools/pool'

const events = new Hono<{ Bindings: Bindings }>()

// GET /api/events/:id - 単一イベント取得
events.get('/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB

  // キャッシュから
  try {
    const cached = await getCachedEventById(db, id)
    if (cached) {
      return c.json({ event: cached, source: 'cache' })
    }
  } catch (e) {
    console.error('Cache read error:', e)
  }

  // リレーから
  const pool = new SimplePool()

  try {
    const relayEvents = await pool.querySync(RELAYS, { ids: [id] })
    if (relayEvents.length > 0) {
      return c.json({ event: relayEvents[0], source: 'relay' })
    }
    return c.json({ error: 'Event not found' }, 404)
  } finally {
    pool.close(RELAYS)
  }
})

// GET /api/events/:id/raw - イベント本文をプレーンテキストで取得
events.get('/:id/raw', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB

  // キャッシュから
  try {
    const cached = await getCachedEventById(db, id)
    if (cached) {
      return c.text(cached.content, 200, {
        'Content-Type': 'text/plain; charset=utf-8',
      })
    }
  } catch (e) {
    console.error('Cache read error:', e)
  }

  // リレーから
  const pool = new SimplePool()

  try {
    const relayEvents = await pool.querySync(RELAYS, { ids: [id] })
    if (relayEvents.length > 0) {
      return c.text(relayEvents[0].content, 200, {
        'Content-Type': 'text/plain; charset=utf-8',
      })
    }
    return c.text('Event not found', 404)
  } finally {
    pool.close(RELAYS)
  }
})

export default events
