import { Hono } from 'hono'
import type { Bindings } from '../types'

const PRIMAL_CACHE_URL = 'wss://cache1.primal.net/v1'
const TIMEOUT_MS = 10000
const STATS_KIND = 10000105

const userCount = new Hono<{ Bindings: Bindings }>()

interface UserStats {
  note_count?: number
  long_form_note_count?: number
  reply_count?: number
  followers_count?: number
  follows_count?: number
}

// Primal cacheからユーザー統計を取得
async function fetchUserStatsFromPrimal(pubkey: string): Promise<UserStats | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      ws.close()
      resolve(null)
    }, TIMEOUT_MS)

    // Cloudflare Workers用のWebSocket接続
    const ws = new WebSocket(PRIMAL_CACHE_URL)

    ws.addEventListener('open', () => {
      const req = JSON.stringify(['REQ', 'stats', { cache: ['user_profile', { pubkey }] }])
      ws.send(req)
    })

    ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data as string)
        // kind 10000105のイベントを探す（ユーザー統計）
        if (Array.isArray(data) && data[0] === 'EVENT' && data[2]?.kind === STATS_KIND) {
          const content = JSON.parse(data[2].content)
          clearTimeout(timeout)
          ws.close()
          resolve(content as UserStats)
        } else if (Array.isArray(data) && data[0] === 'EOSE') {
          // 統計が見つからない場合
          clearTimeout(timeout)
          ws.close()
          resolve(null)
        }
      } catch {
        // パースエラーは無視
      }
    })

    ws.addEventListener('error', () => {
      clearTimeout(timeout)
      ws.close()
      resolve(null)
    })
  })
}

// GET /api/user/:pubkey/count - ユーザーの投稿数を取得
userCount.get('/:pubkey/count', async (c) => {
  const pubkey = c.req.param('pubkey')

  if (!pubkey || pubkey.length !== 64) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  try {
    const stats = await fetchUserStatsFromPrimal(pubkey)

    if (stats && typeof stats.note_count === 'number') {
      return c.json({
        count: stats.note_count + (stats.long_form_note_count || 0),
        noteCount: stats.note_count,
        longFormCount: stats.long_form_note_count || 0,
      })
    }

    return c.json({ count: null, error: 'Could not fetch user stats' })
  } catch (e) {
    return c.json({ count: null, error: String(e) })
  }
})

// GET /api/user/:pubkey/stella - ユーザーの累計ステラ数を取得
userCount.get('/:pubkey/stella', async (c) => {
  const pubkey = c.req.param('pubkey')

  if (!pubkey || pubkey.length !== 64) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  try {
    const db = c.env.DB
    const result = await db
      .prepare('SELECT COALESCE(SUM(stella_count), 0) as total FROM user_stella WHERE author_pubkey = ?')
      .bind(pubkey)
      .first<{ total: number }>()

    return c.json({ total: result?.total ?? 0 })
  } catch (e) {
    console.error('Stella count error:', e)
    return c.json({ total: 0, error: String(e) })
  }
})

export default userCount
