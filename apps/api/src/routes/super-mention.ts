import { Hono } from 'hono'
import type { Bindings } from '../types'

const superMention = new Hono<{ Bindings: Bindings }>()

// POST /api/super-mention/paths - パス保存
superMention.post('/paths', async (c) => {
  const db = c.env.DB

  try {
    const body = await c.req.json<{
      path: string
      category: string
      wikidataId?: string
      wikidataLabel?: string
      wikidataDescription?: string
    }>()

    if (!body.path || !body.category) {
      return c.json({ error: 'path and category required' }, 400)
    }

    const now = Math.floor(Date.now() / 1000)

    // UPSERT: 存在すれば use_count を増加、なければ新規作成
    await db
      .prepare(
        `
        INSERT INTO super_mention_paths (path, category, wikidata_id, wikidata_label, wikidata_description, use_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
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
        body.category,
        body.wikidataId || null,
        body.wikidataLabel || null,
        body.wikidataDescription || null,
        now,
        now
      )
      .run()

    return c.json({ success: true })
  } catch (e) {
    console.error('Save path error:', e)
    return c.json({ error: 'Failed to save path' }, 500)
  }
})

// GET /api/super-mention/suggest - パスのサジェスト
superMention.get('/suggest', async (c) => {
  const db = c.env.DB
  const prefix = c.req.query('prefix') || ''
  const category = c.req.query('category')
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 50)

  try {
    let query: string
    let params: (string | number)[]

    if (category) {
      // カテゴリ指定あり: そのカテゴリ内で検索
      query = `
        SELECT path, category, wikidata_id, wikidata_label, wikidata_description, use_count
        FROM super_mention_paths
        WHERE category = ? AND path LIKE ?
        ORDER BY use_count DESC, updated_at DESC
        LIMIT ?
      `
      params = [category, `/${category}/${prefix}%`, limit]
    } else if (prefix) {
      // プレフィックス検索
      query = `
        SELECT path, category, wikidata_id, wikidata_label, wikidata_description, use_count
        FROM super_mention_paths
        WHERE path LIKE ?
        ORDER BY use_count DESC, updated_at DESC
        LIMIT ?
      `
      params = [`${prefix}%`, limit]
    } else {
      // 人気のパスを返す
      query = `
        SELECT path, category, wikidata_id, wikidata_label, wikidata_description, use_count
        FROM super_mention_paths
        ORDER BY use_count DESC, updated_at DESC
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
          category: row.category,
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
