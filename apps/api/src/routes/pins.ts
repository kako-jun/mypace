import { Hono } from 'hono'
import type { Bindings } from '../types'
import { getCurrentTimestamp, isValidPubkey, isValidEventId } from '../utils'

const pins = new Hono<{ Bindings: Bindings }>()

// GET /api/pins/:pubkey - Get pinned event ID for a user
pins.get('/:pubkey', async (c) => {
  const db = c.env.DB
  const pubkey = c.req.param('pubkey')

  if (!isValidPubkey(pubkey)) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  try {
    const result = await db.prepare('SELECT event_id, created_at FROM user_pins WHERE pubkey = ?').bind(pubkey).first()

    if (!result) {
      return c.json({ eventId: null })
    }

    return c.json({
      eventId: result.event_id,
      createdAt: result.created_at,
    })
  } catch (e) {
    console.error('Get pin error:', e)
    return c.json({ error: 'Failed to get pinned post' }, 500)
  }
})

// POST /api/pins - Set pinned post
pins.post('/', async (c) => {
  const db = c.env.DB

  try {
    const body = await c.req.json<{ pubkey: string; eventId: string }>()

    if (!isValidPubkey(body.pubkey)) {
      return c.json({ error: 'Invalid pubkey' }, 400)
    }

    if (!isValidEventId(body.eventId)) {
      return c.json({ error: 'Invalid eventId' }, 400)
    }

    const now = getCurrentTimestamp()

    // UPSERT: replace if exists
    await db
      .prepare(
        `INSERT INTO user_pins (pubkey, event_id, created_at)
         VALUES (?, ?, ?)
         ON CONFLICT(pubkey) DO UPDATE SET
           event_id = excluded.event_id,
           created_at = excluded.created_at`
      )
      .bind(body.pubkey, body.eventId, now)
      .run()

    return c.json({ success: true })
  } catch (e) {
    console.error('Set pin error:', e)
    return c.json({ error: 'Failed to set pinned post' }, 500)
  }
})

// DELETE /api/pins/:pubkey - Remove pinned post
pins.delete('/:pubkey', async (c) => {
  const db = c.env.DB
  const pubkey = c.req.param('pubkey')

  if (!isValidPubkey(pubkey)) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  try {
    await db.prepare('DELETE FROM user_pins WHERE pubkey = ?').bind(pubkey).run()

    return c.json({ success: true })
  } catch (e) {
    console.error('Delete pin error:', e)
    return c.json({ error: 'Failed to remove pinned post' }, 500)
  }
})

export default pins
