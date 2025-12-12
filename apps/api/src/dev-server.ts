// Node.js development server for local development
// Uses @hono/node-server instead of wrangler/miniflare
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { SimplePool } from 'nostr-tools/pool'
import type { Event, Filter } from 'nostr-tools'
import dotenv from 'dotenv'

// Load .env file
dotenv.config()

const app = new Hono()

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

// 言語判定（簡易版）
function detectLanguage(text: string): string {
  // 日本語（ひらがな・カタカナがあれば日本語）
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja'
  // 韓国語（ハングル）
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return 'ko'
  // 中国語（漢字があり、ひらがな・カタカナがない）
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh'
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

// Create WebSocket class with optional HTTP proxy
async function createWebSocketClass(proxyUrl?: string) {
  const WebSocket = (await import('ws')).default

  if (proxyUrl) {
    console.log('Using HTTP proxy:', proxyUrl)
    const { HttpsProxyAgent } = await import('https-proxy-agent')
    const agent = new HttpsProxyAgent(proxyUrl)

    return class ProxiedWebSocket extends WebSocket {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols, { agent })
        this.on('open', () => console.log('Connected:', url))
        this.on('error', (e: Error) => console.log('WebSocket error:', url, e.message))
      }
    }
  } else {
    console.log('No HTTP proxy configured')
    return WebSocket
  }
}

// Create pool with custom WebSocket implementation
async function createPool(proxyUrl?: string) {
  const WebSocketClass = await createWebSocketClass(proxyUrl)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new SimplePool({ websocketImplementation: WebSocketClass } as any)
}

const HTTP_PROXY = process.env.HTTP_PROXY

// GET /api/timeline - タイムライン取得
app.get('/api/timeline', async (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100)
  const since = Number(c.req.query('since')) || 0
  const showAll = c.req.query('all') === '1'
  const langFilter = c.req.query('lang') || ''

  const pool = await createPool(HTTP_PROXY)

  try {
    const filter: Filter = {
      kinds: [1],
      limit: langFilter ? limit * 3 : limit, // 言語フィルタ時は多めに取得
    }
    // mypaceタグでフィルタリング（all=1でない場合のみ）
    if (!showAll) {
      filter['#t'] = [MYPACE_TAG]
    }
    if (since > 0) {
      filter.since = since
    }

    console.log('Querying relays with filter:', filter)
    let events = await pool.querySync(RELAYS, filter)
    console.log('Got events from relay:', events.length)
    events.sort((a, b) => b.created_at - a.created_at)

    // 言語フィルタ（ユーザーの主要言語も考慮）
    if (langFilter) {
      events = filterByLanguage(events, langFilter)
      events = events.slice(0, limit)
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
  const pool = await createPool(HTTP_PROXY)

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

  const pool = await createPool(HTTP_PROXY)
  const profiles: Record<string, unknown> = {}

  try {
    const events = await pool.querySync(RELAYS, { kinds: [0], authors: pubkeys })

    for (const event of events) {
      try {
        profiles[event.pubkey] = JSON.parse(event.content)
      } catch (e) {
        console.error('Profile parse error:', e)
      }
    }

    return c.json({ profiles })
  } finally {
    pool.close(RELAYS)
  }
})

// GET /api/reactions/:eventId - リアクション取得
app.get('/api/reactions/:eventId', async (c) => {
  const eventId = c.req.param('eventId')
  const pubkey = c.req.query('pubkey')

  const pool = await createPool(HTTP_PROXY)

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

  const pool = await createPool(HTTP_PROXY)

  try {
    const events = await pool.querySync(RELAYS, { kinds: [1], '#e': [eventId] })
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

  const pool = await createPool(HTTP_PROXY)

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
  const since = Number(c.req.query('since')) || 0
  const until = Number(c.req.query('until')) || 0

  const pool = await createPool(HTTP_PROXY)

  try {
    const filter: Filter = {
      kinds: [1],
      authors: [pubkey],
      '#t': [MYPACE_TAG],
      limit,
    }
    if (since > 0) {
      filter.since = since
    }
    if (until > 0) {
      filter.until = until
    }

    const events = await pool.querySync(RELAYS, filter)
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

  const pool = await createPool(HTTP_PROXY)

  try {
    await Promise.all(pool.publish(RELAYS, event))
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

const port = 8787
console.log(`Starting dev server on http://localhost:${port}`)
console.log(`HTTP_PROXY: ${HTTP_PROXY || '(not set)'}`)

serve({
  fetch: app.fetch,
  port,
})
