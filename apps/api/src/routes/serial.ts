import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { Bindings } from '../types'

const serial = new Hono<{ Bindings: Bindings }>()

// GET /api/serial/:pubkey - ユーザーの通し番号を取得
serial.get('/:pubkey', async (c) => {
  const pubkey = c.req.param('pubkey')
  const db = c.env.DB

  try {
    const result = await db
      .prepare('SELECT serial_number, first_post_at, visible FROM user_serial WHERE pubkey = ?')
      .bind(pubkey)
      .first<{ serial_number: number; first_post_at: number; visible: number }>()

    if (!result) {
      return c.json({ serial: null })
    }

    return c.json({
      serial: result.serial_number,
      firstPostAt: result.first_post_at,
      visible: result.visible === 1,
    })
  } catch (e) {
    console.error('Serial fetch error:', e)
    return c.json({ error: 'Failed to fetch serial' }, 500)
  }
})

// GET /api/serial - ユーザー一覧（番号順）
serial.get('/', async (c) => {
  const db = c.env.DB
  const limit = parseInt(c.req.query('limit') || '100')
  const offset = parseInt(c.req.query('offset') || '0')
  const visibleOnly = c.req.query('visible') !== 'false'

  try {
    const whereClause = visibleOnly ? 'WHERE visible = 1' : ''
    const results = await db
      .prepare(
        `SELECT pubkey, serial_number, first_post_at, visible
         FROM user_serial
         ${whereClause}
         ORDER BY serial_number ASC
         LIMIT ? OFFSET ?`
      )
      .bind(limit, offset)
      .all<{ pubkey: string; serial_number: number; first_post_at: number; visible: number }>()

    const countResult = await db
      .prepare(`SELECT COUNT(*) as count FROM user_serial ${whereClause}`)
      .first<{ count: number }>()

    const users = (results.results || []).map((u) => ({
      pubkey: u.pubkey,
      serial: u.serial_number,
      firstPostAt: u.first_post_at,
      visible: u.visible === 1,
    }))

    return c.json({
      users,
      total: countResult?.count || 0,
    })
  } catch (e) {
    console.error('Serial list error:', e)
    return c.json({ error: 'Failed to fetch serial list' }, 500)
  }
})

// POST /api/serial/register - 新規ユーザー登録（内部用）
serial.post('/register', async (c) => {
  const body = await c.req.json<{ pubkey: string; firstPostId: string; firstPostAt: number }>()
  const { pubkey, firstPostId, firstPostAt } = body
  const db = c.env.DB

  if (!pubkey || !firstPostId || !firstPostAt) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  try {
    // 既に登録済みかチェック
    const existing = await db
      .prepare('SELECT serial_number FROM user_serial WHERE pubkey = ?')
      .bind(pubkey)
      .first<{ serial_number: number }>()

    if (existing) {
      return c.json({
        serial: existing.serial_number,
        alreadyRegistered: true,
      })
    }

    // 新規登録
    const now = Math.floor(Date.now() / 1000)
    await db
      .prepare(
        `INSERT INTO user_serial (pubkey, serial_number, first_post_id, first_post_at, visible, created_at)
         VALUES (?, (SELECT COALESCE(MAX(serial_number), 0) + 1 FROM user_serial), ?, ?, 1, ?)`
      )
      .bind(pubkey, firstPostId, firstPostAt, now)
      .run()

    // 付与された番号を取得
    const newSerial = await db
      .prepare('SELECT serial_number FROM user_serial WHERE pubkey = ?')
      .bind(pubkey)
      .first<{ serial_number: number }>()

    return c.json({
      serial: newSerial?.serial_number,
      alreadyRegistered: false,
    })
  } catch (e) {
    console.error('Serial register error:', e)
    return c.json({ error: 'Failed to register serial' }, 500)
  }
})

// POST /api/serial/visibility - 表示設定変更
serial.post('/visibility', async (c) => {
  const body = await c.req.json<{ pubkey: string; visible: boolean }>()
  const { pubkey, visible } = body
  const db = c.env.DB

  if (!pubkey || visible === undefined) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  try {
    await db
      .prepare('UPDATE user_serial SET visible = ? WHERE pubkey = ?')
      .bind(visible ? 1 : 0, pubkey)
      .run()

    return c.json({ success: true, visible })
  } catch (e) {
    console.error('Serial visibility update error:', e)
    return c.json({ error: 'Failed to update visibility' }, 500)
  }
})

// POST /api/serial/init - 既存ユーザーの初期化（管理用）
serial.post('/init', async (c) => {
  const db = c.env.DB

  try {
    // #mypaceタグを持つkind:1投稿を持つユーザーを、最初の投稿時刻順に取得
    const mypaceUsers = await db
      .prepare(
        `SELECT pubkey, MIN(created_at) as first_post_at,
                (SELECT id FROM events e2 WHERE e2.pubkey = e1.pubkey AND e2.kind = 1
                 AND e2.tags LIKE '%"mypace"%' ORDER BY created_at ASC LIMIT 1) as first_post_id
         FROM events e1
         WHERE kind = 1 AND tags LIKE '%"mypace"%'
         GROUP BY pubkey
         ORDER BY first_post_at ASC`
      )
      .all<{ pubkey: string; first_post_at: number; first_post_id: string }>()

    const users = mypaceUsers.results || []
    let registered = 0
    let skipped = 0

    for (const user of users) {
      // 既に登録済みかチェック
      const existing = await db
        .prepare('SELECT serial_number FROM user_serial WHERE pubkey = ?')
        .bind(user.pubkey)
        .first()

      if (existing) {
        skipped++
        continue
      }

      // 新規登録
      const now = Math.floor(Date.now() / 1000)
      await db
        .prepare(
          `INSERT INTO user_serial (pubkey, serial_number, first_post_id, first_post_at, visible, created_at)
           VALUES (?, (SELECT COALESCE(MAX(serial_number), 0) + 1 FROM user_serial), ?, ?, 1, ?)`
        )
        .bind(user.pubkey, user.first_post_id, user.first_post_at, now)
        .run()

      registered++
    }

    return c.json({
      success: true,
      total: users.length,
      registered,
      skipped,
    })
  } catch (e) {
    console.error('Serial init error:', e)
    return c.json({ error: 'Failed to initialize serials' }, 500)
  }
})

export default serial

// ヘルパー関数をエクスポート（publish.tsから使用）
export async function registerUserSerial(
  db: D1Database,
  pubkey: string,
  firstPostId: string,
  firstPostAt: number
): Promise<{ serial: number; alreadyRegistered: boolean } | null> {
  try {
    // 既に登録済みかチェック
    const existing = await db
      .prepare('SELECT serial_number FROM user_serial WHERE pubkey = ?')
      .bind(pubkey)
      .first<{ serial_number: number }>()

    if (existing) {
      return {
        serial: existing.serial_number,
        alreadyRegistered: true,
      }
    }

    // 新規登録
    const now = Math.floor(Date.now() / 1000)
    await db
      .prepare(
        `INSERT INTO user_serial (pubkey, serial_number, first_post_id, first_post_at, visible, created_at)
         VALUES (?, (SELECT COALESCE(MAX(serial_number), 0) + 1 FROM user_serial), ?, ?, 1, ?)`
      )
      .bind(pubkey, firstPostId, firstPostAt, now)
      .run()

    // 付与された番号を取得
    const newSerial = await db
      .prepare('SELECT serial_number FROM user_serial WHERE pubkey = ?')
      .bind(pubkey)
      .first<{ serial_number: number }>()

    return {
      serial: newSerial?.serial_number || 0,
      alreadyRegistered: false,
    }
  } catch (e) {
    console.error('Register user serial error:', e)
    return null
  }
}
