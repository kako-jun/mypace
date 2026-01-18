import { Hono } from 'hono'
import type { Bindings } from '../types'

const superMention = new Hono<{ Bindings: Bindings }>()

// POST /api/super-mention/paths - パス保存
superMention.post('/paths', async (c) => {
  const db = c.env.DB

  try {
    const body = await c.req.json<{
      path: string
      wikidataId?: string
      wikidataLabel?: string
      wikidataDescription?: string
      clearWikidata?: boolean
    }>()

    if (!body.path) {
      return c.json({ error: 'path required' }, 400)
    }

    const now = Math.floor(Date.now() / 1000)

    // If clearWikidata is true, explicitly set wikidata fields to NULL
    if (body.clearWikidata) {
      await db
        .prepare(
          `
          INSERT INTO super_mention_paths (path, category, wikidata_id, wikidata_label, wikidata_description, use_count, created_at, updated_at)
          VALUES (?, '', NULL, NULL, NULL, 1, ?, ?)
          ON CONFLICT(path) DO UPDATE SET
            use_count = use_count + 1,
            wikidata_id = NULL,
            wikidata_label = NULL,
            wikidata_description = NULL,
            updated_at = excluded.updated_at
        `
        )
        .bind(body.path, now, now)
        .run()
    } else {
      // UPSERT: 存在すれば use_count を増加、なければ新規作成
      await db
        .prepare(
          `
          INSERT INTO super_mention_paths (path, category, wikidata_id, wikidata_label, wikidata_description, use_count, created_at, updated_at)
          VALUES (?, '', ?, ?, ?, 1, ?, ?)
          ON CONFLICT(path) DO UPDATE SET
            use_count = use_count + 1,
            wikidata_id = COALESCE(excluded.wikidata_id, wikidata_id),
            wikidata_label = COALESCE(excluded.wikidata_label, wikidata_label),
            wikidata_description = COALESCE(excluded.wikidata_description, wikidata_description),
            updated_at = excluded.updated_at
        `
        )
        .bind(
          body.path,
          body.wikidataId || null,
          body.wikidataLabel || null,
          body.wikidataDescription || null,
          now,
          now
        )
        .run()
    }

    return c.json({ success: true })
  } catch (e) {
    console.error('Save path error:', e)
    return c.json({ error: 'Failed to save path' }, 500)
  }
})

// DELETE /api/super-mention/delete - パス削除（誰でも削除可能）
superMention.delete('/delete', async (c) => {
  const db = c.env.DB

  try {
    const body = await c.req.json<{ path: string }>()

    if (!body.path) {
      return c.json({ error: 'path required' }, 400)
    }

    await db.prepare('DELETE FROM super_mention_paths WHERE path = ?').bind(body.path).run()

    return c.json({ success: true })
  } catch (e) {
    console.error('Delete path error:', e)
    return c.json({ error: 'Failed to delete path' }, 500)
  }
})

// GET /api/super-mention/suggest - パスのサジェスト
superMention.get('/suggest', async (c) => {
  const db = c.env.DB
  const prefix = c.req.query('prefix') || ''
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 50)

  try {
    let query: string
    let params: (string | number)[]

    if (prefix) {
      // 部分一致検索（パスまたはラベルに含まれる）
      query = `
        SELECT path, wikidata_id, wikidata_label, wikidata_description, use_count
        FROM super_mention_paths
        WHERE path LIKE ? OR wikidata_label LIKE ?
        ORDER BY updated_at DESC
        LIMIT ?
      `
      params = [`%${prefix}%`, `%${prefix}%`, limit]
    } else {
      // 最近使用したものを返す
      query = `
        SELECT path, wikidata_id, wikidata_label, wikidata_description, use_count
        FROM super_mention_paths
        ORDER BY updated_at DESC
        LIMIT ?
      `
      params = [limit]
    }

    const result = await db
      .prepare(query)
      .bind(...params)
      .all()

    return c.json({
      suggestions:
        result.results?.map((row) => ({
          path: row.path,
          wikidataId: row.wikidata_id,
          wikidataLabel: row.wikidata_label,
          wikidataDescription: row.wikidata_description,
          useCount: row.use_count,
        })) || [],
    })
  } catch (e) {
    console.error('Suggest error:', e)
    return c.json({ error: 'Failed to get suggestions' }, 500)
  }
})

export default superMention
