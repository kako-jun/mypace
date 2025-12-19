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

const NOSTR_PROXY = process.env.NOSTR_PROXY

// GET /api/timeline - タイムライン取得
app.get('/api/timeline', async (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100)
  const since = Number(c.req.query('since')) || 0
  const until = Number(c.req.query('until')) || 0
  const showAll = c.req.query('all') === '1'
  const langFilter = c.req.query('lang') || ''
  // Parse kinds parameter (default: 1 and 30023)
  const kindsParam = c.req.query('kinds')
  const kinds = kindsParam
    ? kindsParam
        .split(',')
        .map((k) => parseInt(k, 10))
        .filter((k) => !isNaN(k))
    : [1, 30023]

  const pool = await createPool(NOSTR_PROXY)

  try {
    const filter: Filter = {
      kinds,
      limit: langFilter ? limit * 3 : limit, // 言語フィルタ時は多めに取得
    }
    // mypaceタグでフィルタリング（all=1でない場合のみ）
    if (!showAll) {
      filter['#t'] = [MYPACE_TAG]
    }
    if (since > 0) {
      filter.since = since
    }
    if (until > 0) {
      filter.until = until
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
  const pool = await createPool(NOSTR_PROXY)

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

  const pool = await createPool(NOSTR_PROXY)
  const profiles: Record<string, unknown> = {}

  try {
    const events = await pool.querySync(RELAYS, { kinds: [0], authors: pubkeys })

    for (const event of events) {
      try {
        const profile = JSON.parse(event.content)
        // Extract emoji tags (NIP-30)
        const emojis = event.tags
          .filter((t: string[]) => t[0] === 'emoji' && t[1] && t[2])
          .map((t: string[]) => ({ shortcode: t[1], url: t[2] }))
        profiles[event.pubkey] = { ...profile, emojis }
      } catch (e) {
        console.error('Profile parse error:', e)
      }
    }

    return c.json({ profiles })
  } finally {
    pool.close(RELAYS)
  }
})

// Custom tag for stella count
const STELLA_TAG = 'stella'

// Get stella count from reaction event tags
function getStellaCount(event: Event): number {
  const stellaTag = event.tags.find((t) => t[0] === STELLA_TAG)
  if (stellaTag && stellaTag[1]) {
    const count = parseInt(stellaTag[1], 10)
    return isNaN(count) ? 1 : count
  }
  return 1 // Default to 1 for reactions without stella tag
}

// GET /api/reactions/:eventId - リアクション取得
app.get('/api/reactions/:eventId', async (c) => {
  const eventId = c.req.param('eventId')
  const pubkey = c.req.query('pubkey')

  const pool = await createPool(NOSTR_PROXY)

  try {
    const events = await pool.querySync(RELAYS, { kinds: [7], '#e': [eventId] })

    // Group reactions by pubkey, keeping only the newest one per user
    const reactorMap = new Map<string, { pubkey: string; stella: number; reactionId: string; createdAt: number }>()
    for (const e of events) {
      const existing = reactorMap.get(e.pubkey)
      // Keep the newest reaction for each user
      if (!existing || e.created_at > existing.createdAt) {
        reactorMap.set(e.pubkey, {
          pubkey: e.pubkey,
          stella: getStellaCount(e),
          reactionId: e.id,
          createdAt: e.created_at,
        })
      }
    }

    // Build list of reactors (sorted by newest first)
    const reactors = Array.from(reactorMap.values()).sort((a, b) => b.createdAt - a.createdAt)

    // Sum stella from deduplicated reactors
    const count = reactors.reduce((sum, r) => sum + r.stella, 0)

    // Find user's reaction
    let myStella = 0
    let myReactionId: string | null = null
    if (pubkey) {
      const myReaction = reactorMap.get(pubkey)
      if (myReaction) {
        myStella = myReaction.stella
        myReactionId = myReaction.reactionId
      }
    }

    return c.json({ count, myReaction: myStella > 0, myStella, myReactionId, reactors })
  } finally {
    pool.close(RELAYS)
  }
})

// GET /api/replies/:eventId - 返信取得
app.get('/api/replies/:eventId', async (c) => {
  const eventId = c.req.param('eventId')

  const pool = await createPool(NOSTR_PROXY)

  try {
    // Kind 1 (short notes) + Kind 30023 (long articles) as replies
    const events = await pool.querySync(RELAYS, { kinds: [1, 30023], '#e': [eventId] })
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

  const pool = await createPool(NOSTR_PROXY)

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

  const pool = await createPool(NOSTR_PROXY)

  try {
    const filter: Filter = {
      kinds: [1, 30023],
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

  const pool = await createPool(NOSTR_PROXY)

  try {
    const results = await Promise.allSettled(pool.publish(RELAYS, event))
    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected')

    if (failed.length > 0) {
      console.log(`Publish: ${succeeded}/${results.length} relays succeeded`)
      failed.forEach((r) => console.error('Publish error:', (r as PromiseRejectedResult).reason))
    }

    if (succeeded > 0) {
      return c.json({ success: true, id: event.id })
    } else {
      return c.json({ error: 'Failed to publish to any relay' }, 500)
    }
  } finally {
    pool.close(RELAYS)
  }
})

// GET /api/ogp - OGPメタデータ取得
app.get('/api/ogp', async (c) => {
  const url = c.req.query('url')

  if (!url) {
    return c.json({ error: 'URL is required' }, 400)
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'mypace-bot/1.0 (OGP fetcher)',
        Accept: 'text/html',
      },
    })

    if (!response.ok) {
      return c.json({ error: 'Failed to fetch URL' }, 502)
    }

    const html = await response.text()

    // Parse OGP tags
    const getMetaContent = (property: string): string | undefined => {
      const regex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i')
      const altRegex = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`, 'i')
      const match = html.match(regex) || html.match(altRegex)
      return match?.[1]
    }

    const ogp = {
      title: getMetaContent('og:title') || html.match(/<title>([^<]*)<\/title>/i)?.[1],
      description: getMetaContent('og:description'),
      image: getMetaContent('og:image'),
      siteName: getMetaContent('og:site_name'),
    }

    return c.json(ogp)
  } catch (e) {
    console.error('OGP fetch error:', e)
    return c.json({ error: 'Failed to fetch OGP' }, 500)
  }
})

// GET /api/tweet/:id - ツイートデータ取得（react-tweet用）
app.get('/api/tweet/:id', async (c) => {
  const tweetId = c.req.param('id')

  if (!tweetId || !/^\d+$/.test(tweetId)) {
    return c.json({ error: 'Invalid tweet ID' }, 400)
  }

  try {
    // Twitter Syndication API
    const response = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=0`, {
      headers: {
        'User-Agent': 'mypace-bot/1.0',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return c.json({ error: 'Tweet not found' }, 404)
      }
      return c.json({ error: 'Failed to fetch tweet' }, 502)
    }

    const data = await response.json()
    return c.json(data)
  } catch (e) {
    console.error('Tweet fetch error:', e)
    return c.json({ error: 'Failed to fetch tweet' }, 500)
  }
})

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

const port = 8787
console.log(`Starting dev server on http://localhost:${port}`)
console.log(`NOSTR_PROXY: ${NOSTR_PROXY || '(not set)'}`)

serve({
  fetch: app.fetch,
  port,
})
