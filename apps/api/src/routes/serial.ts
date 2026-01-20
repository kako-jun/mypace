import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { Filter } from 'nostr-tools'
import { SimplePool } from 'nostr-tools/pool'
import type { Bindings } from '../types'
import { MYPACE_TAG, ALL_RELAYS, PAGINATION_MAX_LIMIT, PAGINATION_DEFAULT_LIMIT } from '../constants'
import { getCurrentTimestamp, parsePaginationLimit, parsePaginationOffset } from '../utils'

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
  const limit = parsePaginationLimit(c.req.query('limit'), PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT)
  const offset = parsePaginationOffset(c.req.query('offset'))
  const visibleOnly = c.req.query('visible') !== 'false'

  try {
    const whereClause = visibleOnly ? 'WHERE visible = 1' : ''
    // Run both queries in parallel
    const [results, countResult] = await Promise.all([
      db
        .prepare(
          `SELECT pubkey, serial_number, first_post_at, visible
           FROM user_serial
           ${whereClause}
           ORDER BY serial_number ASC
           LIMIT ? OFFSET ?`
        )
        .bind(limit, offset)
        .all<{ pubkey: string; serial_number: number; first_post_at: number; visible: number }>(),
      db.prepare(`SELECT COUNT(*) as count FROM user_serial ${whereClause}`).first<{ count: number }>(),
    ])

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
    const now = getCurrentTimestamp()
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
// Nostrリレーから過去の#mypace投稿を取得して番号を付与
serial.post('/init', async (c) => {
  // リレー設定
  const relayCount = c.env.RELAY_COUNT !== undefined ? parseInt(c.env.RELAY_COUNT, 10) : ALL_RELAYS.length
  const RELAYS = ALL_RELAYS.slice(0, Math.max(0, relayCount))

  // RELAY_COUNT=0の場合はリレー接続をスキップ
  if (RELAYS.length === 0) {
    return c.json({ error: 'Relay connection disabled' }, 503)
  }

  const db = c.env.DB
  const pool = new SimplePool()

  try {
    // Nostrリレーから#mypaceタグを持つ全投稿を取得
    const filter: Filter = {
      kinds: [1],
      '#t': [MYPACE_TAG],
      limit: 5000, // 十分な数を取得
    }

    console.log('Fetching #mypace posts from relays...')
    const events = await pool.querySync(RELAYS, filter)
    console.log(`Fetched ${events.length} events from relays`)

    // ユーザーごとに最初の投稿を集計
    const userFirstPost = new Map<string, { id: string; created_at: number }>()

    for (const event of events) {
      const existing = userFirstPost.get(event.pubkey)
      if (!existing || event.created_at < existing.created_at) {
        userFirstPost.set(event.pubkey, {
          id: event.id,
          created_at: event.created_at,
        })
      }
    }

    // 最初の投稿時刻順でソート
    const sortedUsers = Array.from(userFirstPost.entries()).sort((a, b) => a[1].created_at - b[1].created_at)

    console.log(`Found ${sortedUsers.length} unique users`)

    // 全pubkeyを一括で既存チェック（N+1回避）
    const allPubkeys = sortedUsers.map(([pubkey]) => pubkey)
    const existingPubkeys = new Set<string>()

    if (allPubkeys.length > 0) {
      // D1は大きなIN句をサポートするが、念のためチャンク分割
      const chunkSize = 500
      for (let i = 0; i < allPubkeys.length; i += chunkSize) {
        const chunk = allPubkeys.slice(i, i + chunkSize)
        const placeholders = chunk.map(() => '?').join(',')
        const result = await db
          .prepare(`SELECT pubkey FROM user_serial WHERE pubkey IN (${placeholders})`)
          .bind(...chunk)
          .all<{ pubkey: string }>()

        for (const row of result.results || []) {
          existingPubkeys.add(row.pubkey)
        }
      }
    }

    let registered = 0
    const skipped = existingPubkeys.size

    // 新規ユーザーのみ登録
    for (const [pubkey, { id: firstPostId, created_at: firstPostAt }] of sortedUsers) {
      if (existingPubkeys.has(pubkey)) continue

      const now = getCurrentTimestamp()
      await db
        .prepare(
          `INSERT INTO user_serial (pubkey, serial_number, first_post_id, first_post_at, visible, created_at)
           VALUES (?, (SELECT COALESCE(MAX(serial_number), 0) + 1 FROM user_serial), ?, ?, 1, ?)`
        )
        .bind(pubkey, firstPostId, firstPostAt, now)
        .run()

      registered++
    }

    return c.json({
      success: true,
      totalEvents: events.length,
      totalUsers: sortedUsers.length,
      registered,
      skipped,
    })
  } catch (e) {
    console.error('Serial init error:', e)
    return c.json({ error: 'Failed to initialize serials' }, 500)
  } finally {
    pool.close(RELAYS)
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
    const now = getCurrentTimestamp()
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
