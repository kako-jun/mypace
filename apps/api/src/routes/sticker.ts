import { Hono } from 'hono'
import type { Bindings } from '../types'

const sticker = new Hono<{ Bindings: Bindings }>()

// POST /api/sticker/save - Save sticker URL to history
sticker.post('/save', async (c) => {
  const db = c.env.DB

  try {
    const body = await c.req.json<{ url: string; pubkey?: string }>()

    if (!body.url) {
      return c.json({ error: 'url required' }, 400)
    }

    const now = Math.floor(Date.now() / 1000)

    // UPSERT: increment use_count if exists, otherwise create new with first_used_by
    // first_used_by is only set on initial insert, never updated
    await db
      .prepare(
        `
        INSERT INTO sticker_history (url, first_used_by, use_count, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?)
        ON CONFLICT(url) DO UPDATE SET
          use_count = use_count + 1,
          updated_at = excluded.updated_at
      `
      )
      .bind(body.url, body.pubkey || null, now, now)
      .run()

    return c.json({ success: true })
  } catch (e) {
    console.error('Save sticker error:', e)
    return c.json({ error: 'Failed to save sticker' }, 500)
  }
})

// GET /api/sticker/history - Get sticker history
sticker.get('/history', async (c) => {
  const db = c.env.DB
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 50)

  try {
    const result = await db
      .prepare(
        `
        SELECT url, use_count
        FROM sticker_history
        ORDER BY updated_at DESC
        LIMIT ?
      `
      )
      .bind(limit)
      .all()

    return c.json({
      stickers:
        result.results?.map((row) => ({
          url: row.url,
          useCount: row.use_count,
        })) || [],
    })
  } catch (e) {
    console.error('Get sticker history error:', e)
    return c.json({ error: 'Failed to get sticker history' }, 500)
  }
})

export default sticker
