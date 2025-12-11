import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { SimplePool } from 'nostr-tools/pool'
import type { Event, Filter } from 'nostr-tools'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS - すべてのオリジンを許可
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })
)

const MYPACE_TAG = 'mypace'
const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const CACHE_TTL_MS = 10 * 1000 // 10秒

// 言語判定（簡易版）
function detectLanguage(text: string): string {
  // 日本語（ひらがな、カタカナ、漢字）
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text)) return 'ja'
  // 韓国語（ハングル）
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return 'ko'
  // 中国語（漢字のみで日本語特有の文字がない場合）
  if (/[\u4E00-\u9FFF]/.test(text) && !/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'zh'
  // スペイン語（特有のアクセント文字）
  if (/[áéíóúüñ¿¡]/i.test(text)) return 'es'
  // フランス語（特有のアクセント文字）
  if (/[àâçéèêëîïôùûü]/i.test(text) && !/[ß]/.test(text)) return 'fr'
  // ドイツ語（特有の文字）
  if (/[äöüß]/i.test(text)) return 'de'
  // デフォルトは英語
  return 'en'
}

// ユーザーの主要言語を判定（英語以外で最も多い言語）
function detectUserPrimaryLanguage(posts: { content: string }[]): string | null {
  const langCounts: Record<string, number> = {}

  for (const post of posts) {
    const lang = detectLanguage(post.content)
    if (lang !== 'en') {
      // 英語以外をカウント
      langCounts[lang] = (langCounts[lang] || 0) + 1
    }
  }

  // 最も多い言語を返す（英語以外がなければnull）
  let maxLang: string | null = null
  let maxCount = 0
  for (const [lang, count] of Object.entries(langCounts)) {
    if (count > maxCount) {
      maxCount = count
      maxLang = lang
    }
  }

  return maxLang
}

// 言語フィルタを適用（ユーザーの主要言語も考慮）
function filterByLanguage<T extends { pubkey: string; content: string }>(events: T[], langFilter: string): T[] {
  if (!langFilter) return events

  // ユーザーごとに投稿をグループ化
  const postsByUser: Record<string, T[]> = {}
  for (const event of events) {
    if (!postsByUser[event.pubkey]) {
      postsByUser[event.pubkey] = []
    }
    postsByUser[event.pubkey].push(event)
  }

  // ユーザーごとの主要言語を判定
  const userPrimaryLang: Record<string, string | null> = {}
  for (const [pubkey, posts] of Object.entries(postsByUser)) {
    userPrimaryLang[pubkey] = detectUserPrimaryLanguage(posts)
  }

  // フィルタリング：投稿の言語がマッチ OR ユーザーの主要言語がマッチ
  return events.filter((e) => {
    const postLang = detectLanguage(e.content)
    const userLang = userPrimaryLang[e.pubkey]

    // 投稿自体がフィルタ言語にマッチ
    if (postLang === langFilter) return true

    // ユーザーの主要言語がフィルタ言語にマッチ（英語投稿でも表示）
    if (userLang === langFilter) return true

    return false
  })
}

// GET /api/timeline - タイムライン取得
// キャッシュ優先（10秒TTL）、TTL切れ時にリレーから取得
app.get('/api/timeline', async (c) => {
  const db = c.env.DB
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100)
  const since = Number(c.req.query('since')) || 0
  const showAll = c.req.query('all') === '1'
  const langFilter = c.req.query('lang') || ''

  // まずキャッシュから取得（TTL内のもののみ）
  const cacheThreshold = Date.now() - CACHE_TTL_MS
  try {
    const cached = await db
      .prepare(
        `
      SELECT id, pubkey, created_at, kind, tags, content, sig
      FROM events
      WHERE kind = 1 AND created_at > ? AND cached_at > ?
      ORDER BY created_at DESC
      LIMIT ?
    `
      )
      .bind(since, cacheThreshold, limit * 2) // フィルタリング後に足りなくならないよう多めに取得
      .all()

    if (cached.results.length > 0) {
      let events = cached.results.map((row) => ({
        id: row.id,
        pubkey: row.pubkey,
        created_at: row.created_at,
        kind: row.kind,
        tags: JSON.parse(row.tags as string),
        content: row.content,
        sig: row.sig,
      }))

      if (!showAll) {
        events = events.filter((e) => e.tags.some((t: string[]) => t[0] === 't' && t[1] === MYPACE_TAG))
      }

      if (langFilter) {
        events = filterByLanguage(events, langFilter)
      }

      if (events.length >= limit) {
        return c.json({ events: events.slice(0, limit), source: 'cache' })
      }
    }
  } catch (e) {
    console.error('Cache read error:', e)
  }

  // キャッシュにない/不十分な場合はリレーから取得
  const pool = new SimplePool()

  try {
    const filter: Filter = {
      kinds: [1],
      limit,
    }
    if (!showAll) {
      filter['#t'] = [MYPACE_TAG]
    }
    if (since > 0) {
      filter.since = since
    }

    let events = await pool.querySync(RELAYS, filter)
    events.sort((a, b) => b.created_at - a.created_at)

    // 言語フィルタ（ユーザーの主要言語も考慮）
    if (langFilter) {
      events = filterByLanguage(events, langFilter)
    }

    // キャッシュに保存
    const now = Date.now()
    for (const event of events) {
      try {
        await db
          .prepare(
            `
          INSERT OR REPLACE INTO events (id, pubkey, created_at, kind, tags, content, sig, cached_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .bind(
            event.id,
            event.pubkey,
            event.created_at,
            event.kind,
            JSON.stringify(event.tags),
            event.content,
            event.sig,
            now
          )
          .run()
      } catch (e) {
        console.error('Cache write error:', e)
      }
    }

    return c.json({ events, source: 'relay' })
  } catch (e) {
    console.error('Relay fetch error:', e)
    return c.json({ events: [], error: 'Failed to fetch from relay' }, 500)
  } finally {
    pool.close(RELAYS)
  }
})

// GET /api/events/:id - 単一イベント取得
app.get('/api/events/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB

  // キャッシュから
  try {
    const cached = await db.prepare(`SELECT * FROM events WHERE id = ?`).bind(id).first()
    if (cached) {
      return c.json({
        event: {
          id: cached.id,
          pubkey: cached.pubkey,
          created_at: cached.created_at,
          kind: cached.kind,
          tags: JSON.parse(cached.tags as string),
          content: cached.content,
          sig: cached.sig,
        },
        source: 'cache',
      })
    }
  } catch (e) {
    console.error('Cache read error:', e)
  }

  // リレーから
  const pool = new SimplePool()

  try {
    const events = await pool.querySync(RELAYS, { ids: [id] })
    if (events.length > 0) {
      return c.json({ event: events[0], source: 'relay' })
    }
    return c.json({ error: 'Event not found' }, 404)
  } finally {
    pool.close(RELAYS)
  }
})

// GET /api/profiles - プロフィール取得
app.get('/api/profiles', async (c) => {
  const pubkeys = c.req.query('pubkeys')?.split(',').filter(Boolean) || []
  if (pubkeys.length === 0) {
    return c.json({ profiles: {} })
  }

  const db = c.env.DB
  const profiles: Record<string, unknown> = {}
  const cachedPubkeys: string[] = []

  // キャッシュから（TTL内のもののみ）
  const cacheThreshold = Date.now() - CACHE_TTL_MS
  try {
    const placeholders = pubkeys.map(() => '?').join(',')
    const cached = await db
      .prepare(
        `
      SELECT pubkey, name, display_name, picture, about, nip05
      FROM profiles WHERE pubkey IN (${placeholders}) AND cached_at > ?
    `
      )
      .bind(...pubkeys, cacheThreshold)
      .all()

    for (const row of cached.results) {
      profiles[row.pubkey as string] = {
        name: row.name,
        display_name: row.display_name,
        picture: row.picture,
        about: row.about,
        nip05: row.nip05,
      }
      cachedPubkeys.push(row.pubkey as string)
    }
  } catch (e) {
    console.error('Cache read error:', e)
  }

  // TTL切れまたは見つからなかったpubkeysをリレーから取得
  const missingPubkeys = pubkeys.filter((pk) => !cachedPubkeys.includes(pk))
  if (missingPubkeys.length > 0) {
    const pool = new SimplePool()

    try {
      const events = await pool.querySync(RELAYS, { kinds: [0], authors: missingPubkeys })
      const now = Date.now()

      for (const event of events) {
        try {
          const profile = JSON.parse(event.content)
          profiles[event.pubkey] = profile

          await db
            .prepare(
              `
            INSERT OR REPLACE INTO profiles (pubkey, name, display_name, picture, about, nip05, cached_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
            )
            .bind(event.pubkey, profile.name, profile.display_name, profile.picture, profile.about, profile.nip05, now)
            .run()
        } catch (e) {
          console.error('Profile parse error:', e)
        }
      }
    } finally {
      pool.close(RELAYS)
    }
  }

  return c.json({ profiles })
})

// GET /api/reactions/:eventId - リアクション取得
app.get('/api/reactions/:eventId', async (c) => {
  const eventId = c.req.param('eventId')
  const pubkey = c.req.query('pubkey')

  const pool = new SimplePool()

  try {
    const events = await pool.querySync(RELAYS, { kinds: [7], '#e': [eventId] })
    const count = events.length
    const myReaction = pubkey ? events.some((e) => e.pubkey === pubkey) : false

    return c.json({ count, myReaction })
  } finally {
    pool.close(RELAYS)
  }
})

// GET /api/replies/:eventId - 返信取得
app.get('/api/replies/:eventId', async (c) => {
  const eventId = c.req.param('eventId')

  const pool = new SimplePool()

  try {
    const events = await pool.querySync(RELAYS, { kinds: [1], '#e': [eventId] })
    // ルートへの返信のみフィルタ
    const replies = events.filter((e) => {
      const eTags = e.tags.filter((t) => t[0] === 'e')
      if (eTags.length === 0) return false
      const rootTag = eTags.find((t) => t[3] === 'root') || eTags[0]
      return rootTag[1] === eventId
    })

    return c.json({ count: replies.length, replies })
  } finally {
    pool.close(RELAYS)
  }
})

// GET /api/reposts/:eventId - リポスト取得
app.get('/api/reposts/:eventId', async (c) => {
  const eventId = c.req.param('eventId')
  const pubkey = c.req.query('pubkey')

  const pool = new SimplePool()

  try {
    const events = await pool.querySync(RELAYS, { kinds: [6], '#e': [eventId] })
    const count = events.length
    const myRepost = pubkey ? events.some((e) => e.pubkey === pubkey) : false

    return c.json({ count, myRepost })
  } finally {
    pool.close(RELAYS)
  }
})

// GET /api/user/:pubkey/events - ユーザーの投稿取得
app.get('/api/user/:pubkey/events', async (c) => {
  const pubkey = c.req.param('pubkey')
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100)

  const pool = new SimplePool()

  try {
    const events = await pool.querySync(RELAYS, {
      kinds: [1],
      authors: [pubkey],
      '#t': [MYPACE_TAG],
      limit,
    })
    events.sort((a, b) => b.created_at - a.created_at)

    return c.json({ events })
  } finally {
    pool.close(RELAYS)
  }
})

// POST /api/publish - 署名済みイベントをリレーに投稿
app.post('/api/publish', async (c) => {
  const body = await c.req.json<{ event: Event }>()
  const event = body.event

  if (!event || !event.id || !event.sig) {
    return c.json({ error: 'Invalid event' }, 400)
  }

  const pool = new SimplePool()

  try {
    await Promise.all(pool.publish(RELAYS, event))

    // キャッシュにも保存
    const db = c.env.DB
    const now = Date.now()
    try {
      await db
        .prepare(
          `
        INSERT OR REPLACE INTO events (id, pubkey, created_at, kind, tags, content, sig, cached_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          event.id,
          event.pubkey,
          event.created_at,
          event.kind,
          JSON.stringify(event.tags),
          event.content,
          event.sig,
          now
        )
        .run()
    } catch (e) {
      console.error('Cache write error:', e)
    }

    return c.json({ success: true, id: event.id })
  } catch (e) {
    console.error('Publish error:', e)
    return c.json({ error: 'Failed to publish' }, 500)
  } finally {
    pool.close(RELAYS)
  }
})

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

export default app
