import { Hono } from 'hono'
import type { Bindings } from '../types'
import { getCurrentTimestamp, isValidPubkey } from '../utils'

const uploads = new Hono<{ Bindings: Bindings }>()

// GET /api/uploads/:pubkey - Get upload history for a user
uploads.get('/:pubkey', async (c) => {
  const db = c.env.DB
  const pubkey = c.req.param('pubkey')

  if (!isValidPubkey(pubkey)) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  try {
    const results = await db
      .prepare(
        'SELECT url, filename, type, uploaded_at FROM upload_history WHERE pubkey = ? ORDER BY uploaded_at DESC LIMIT 100'
      )
      .bind(pubkey)
      .all()

    return c.json({
      uploads: results.results.map((row) => ({
        url: row.url,
        filename: row.filename,
        type: row.type,
        uploadedAt: row.uploaded_at,
      })),
    })
  } catch (e) {
    console.error('Get uploads error:', e)
    return c.json({ error: 'Failed to get upload history' }, 500)
  }
})

// POST /api/uploads - Add upload to history
uploads.post('/', async (c) => {
  const db = c.env.DB

  try {
    const body = await c.req.json<{
      pubkey: string
      url: string
      filename: string
      type: 'image' | 'audio'
    }>()

    if (!isValidPubkey(body.pubkey)) {
      return c.json({ error: 'Invalid pubkey' }, 400)
    }

    if (!body.url) {
      return c.json({ error: 'URL is required' }, 400)
    }

    if (!body.filename) {
      return c.json({ error: 'Filename is required' }, 400)
    }

    if (!['image', 'audio'].includes(body.type)) {
      return c.json({ error: 'Invalid type' }, 400)
    }

    const now = getCurrentTimestamp()

    // UPSERT: update timestamp if URL already exists
    await db
      .prepare(
        `INSERT INTO upload_history (pubkey, url, filename, type, uploaded_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(pubkey, url) DO UPDATE SET
           filename = excluded.filename,
           type = excluded.type,
           uploaded_at = excluded.uploaded_at`
      )
      .bind(body.pubkey, body.url, body.filename, body.type, now)
      .run()

    return c.json({ success: true })
  } catch (e) {
    console.error('Add upload error:', e)
    return c.json({ error: 'Failed to add upload' }, 500)
  }
})

// DELETE /api/uploads - Remove upload from history
uploads.delete('/', async (c) => {
  const db = c.env.DB

  try {
    const body = await c.req.json<{ pubkey: string; url: string }>()

    if (!isValidPubkey(body.pubkey)) {
      return c.json({ error: 'Invalid pubkey' }, 400)
    }

    if (!body.url) {
      return c.json({ error: 'URL is required' }, 400)
    }

    await db.prepare('DELETE FROM upload_history WHERE pubkey = ? AND url = ?').bind(body.pubkey, body.url).run()

    return c.json({ success: true })
  } catch (e) {
    console.error('Delete upload error:', e)
    return c.json({ error: 'Failed to remove upload' }, 500)
  }
})

export default uploads
