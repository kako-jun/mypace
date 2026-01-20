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

// GET /api/user/:pubkey/stats - ユーザースタッツ一括取得
userCount.get('/:pubkey/stats', async (c) => {
  const pubkey = c.req.param('pubkey')

  if (!pubkey || pubkey.length !== 64) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  const db = c.env.DB

  try {
    // 並列で全てのスタッツを取得
    const [primalStats, stellaByColor, givenStellaByColor, viewsResult] = await Promise.all([
      fetchUserStatsFromPrimal(pubkey),
      db
        .prepare(
          `SELECT
            COALESCE(stella_color, 'yellow') as color,
            COALESCE(SUM(stella_count), 0) as total
          FROM user_stella
          WHERE author_pubkey = ?
          GROUP BY COALESCE(stella_color, 'yellow')`
        )
        .bind(pubkey)
        .all<{ color: string; total: number }>(),
      db
        .prepare(
          `SELECT
            COALESCE(stella_color, 'yellow') as color,
            COALESCE(SUM(stella_count), 0) as total
          FROM user_stella
          WHERE reactor_pubkey = ?
          GROUP BY COALESCE(stella_color, 'yellow')`
        )
        .bind(pubkey)
        .all<{ color: string; total: number }>(),
      db
        .prepare(
          `SELECT
            COUNT(CASE WHEN view_type = 'detail' THEN 1 END) as details,
            COUNT(CASE WHEN view_type = 'impression' THEN 1 END) as impressions
          FROM event_views
          WHERE author_pubkey = ?`
        )
        .bind(pubkey)
        .first<{ details: number; impressions: number }>(),
    ])

    // Build stellaByColor object with default 0 for all colors
    const stellaColors: Record<string, number> = {
      yellow: 0,
      green: 0,
      red: 0,
      blue: 0,
      purple: 0,
    }
    let totalStella = 0
    if (stellaByColor.results) {
      for (const row of stellaByColor.results) {
        if (row.color in stellaColors) {
          stellaColors[row.color] = row.total
        }
        totalStella += row.total
      }
    }

    // Build givenStellaByColor object with default 0 for all colors
    const givenStellaColors: Record<string, number> = {
      yellow: 0,
      green: 0,
      red: 0,
      blue: 0,
      purple: 0,
    }
    let totalGivenStella = 0
    if (givenStellaByColor.results) {
      for (const row of givenStellaByColor.results) {
        if (row.color in givenStellaColors) {
          givenStellaColors[row.color] = row.total
        }
        totalGivenStella += row.total
      }
    }

    return c.json({
      postsCount: primalStats ? (primalStats.note_count || 0) + (primalStats.long_form_note_count || 0) : null,
      stellaCount: totalStella,
      stellaByColor: stellaColors,
      givenStellaCount: totalGivenStella,
      givenStellaByColor: givenStellaColors,
      viewsCount: {
        details: viewsResult?.details ?? 0,
        impressions: viewsResult?.impressions ?? 0,
      },
    })
  } catch (e) {
    console.error('Stats fetch error:', e)
    return c.json({
      postsCount: null,
      stellaCount: 0,
      stellaByColor: { yellow: 0, green: 0, red: 0, blue: 0, purple: 0 },
      givenStellaCount: 0,
      givenStellaByColor: { yellow: 0, green: 0, red: 0, blue: 0, purple: 0 },
      viewsCount: { details: 0, impressions: 0 },
      error: String(e),
    })
  }
})

export default userCount
