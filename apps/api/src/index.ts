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

// Smart filter: Ad-related tags (スパマーは自らこれらのタグを付ける傾向がある)
const AD_TAGS = [
  'bitcoin',
  'btc',
  'crypto',
  'eth',
  'ethereum',
  'airdrop',
  'nft',
  'ad',
  'sponsored',
  'giveaway',
  'promo',
]
// キーワードは控えめに（誤検出を避ける）- 明らかなスパムフレーズのみ
const AD_KEYWORDS = ['airdrop', 'giveaway', 'free btc', 'free bitcoin']

// Smart filter: NSFW-related tags (NIP-36準拠の投稿者が自己申告で使うタグ)
const NSFW_TAGS = ['nsfw', 'r18', 'r-18', 'adult', 'sensitive', 'nude', 'porn', 'xxx', 'hentai', 'content-warning']
// キーワードは使わない - 責任ある投稿者が警告として書く言葉であり、実際のスパマーは使わない
const NSFW_KEYWORDS: string[] = []

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social',
]
const CACHE_TTL_MS = 10 * 1000 // 10秒

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

// URLの数をカウント
function countUrls(text: string): number {
  const urlPattern = /https?:\/\/[^\s]+/g
  const matches = text.match(urlPattern)
  return matches ? matches.length : 0
}

// スマートフィルタ: 広告/NSFWコンテンツをフィルタ
function filterBySmartFilters<T extends { content: string; tags: string[][] }>(
  events: T[],
  hideAds: boolean,
  hideNSFW: boolean
): T[] {
  if (!hideAds && !hideNSFW) return events

  return events.filter((e) => {
    const contentLower = e.content.toLowerCase()
    const eventTags = e.tags
      .filter((t) => t[0] === 't')
      .map((t) => t[1]?.toLowerCase())
      .filter(Boolean)

    // 広告フィルタ
    if (hideAds) {
      // タグチェック
      if (eventTags.some((tag) => AD_TAGS.includes(tag))) {
        return false
      }
      // キーワードチェック（本文）
      if (AD_KEYWORDS.some((kw) => contentLower.includes(kw.toLowerCase()))) {
        return false
      }
      // リンクが多すぎる（11個以上）はスパム判定
      if (countUrls(e.content) > 10) {
        return false
      }
    }

    // NSFWフィルタ
    if (hideNSFW) {
      // タグチェック
      if (eventTags.some((tag) => NSFW_TAGS.includes(tag))) {
        return false
      }
      // キーワードチェック（本文）
      if (NSFW_KEYWORDS.some((kw) => contentLower.includes(kw.toLowerCase()))) {
        return false
      }
    }

    return true
  })
}

// GET /api/timeline - タイムライン取得
// キャッシュ優先（10秒TTL）、TTL切れ時にリレーから取得
app.get('/api/timeline', async (c) => {
  const db = c.env.DB
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100)
  const since = Number(c.req.query('since')) || 0
  const until = Number(c.req.query('until')) || 0
  const showAll = c.req.query('all') === '1'
  const langFilter = c.req.query('lang') || ''
  // Smart filters: default to hide (hideAds=1, hideNSFW=1)
  const hideAds = c.req.query('hideAds') !== '0'
  const hideNSFW = c.req.query('hideNSFW') !== '0'
  // Parse kinds parameter (default: 1 only, add 30023 if blog=1)
  const kindsParam = c.req.query('kinds')
  const kinds = kindsParam
    ? kindsParam
        .split(',')
        .map((k) => parseInt(k, 10))
        .filter((k) => !isNaN(k))
    : [1, 30023] // Default to both

  // まずキャッシュから取得（TTL内のもののみ）
  const cacheThreshold = Date.now() - CACHE_TTL_MS
  try {
    const kindPlaceholders = kinds.map(() => '?').join(',')
    let query = `
      SELECT id, pubkey, created_at, kind, tags, content, sig
      FROM events
      WHERE kind IN (${kindPlaceholders}) AND created_at > ? AND cached_at > ?
    `
    const params: (number | string)[] = [...kinds, since, cacheThreshold]

    if (until > 0) {
      query += ` AND created_at < ?`
      params.push(until)
    }

    query += ` ORDER BY created_at DESC LIMIT ?`
    params.push(limit * 2) // フィルタリング後に足りなくならないよう多めに取得

    const cached = await db
      .prepare(query)
      .bind(...params)
      .all()

    if (cached.results.length > 0) {
      let events = cached.results.map((row) => ({
        id: row.id as string,
        pubkey: row.pubkey as string,
        created_at: row.created_at as number,
        kind: row.kind as number,
        tags: JSON.parse(row.tags as string) as string[][],
        content: row.content as string,
        sig: row.sig as string,
      }))

      if (!showAll) {
        events = events.filter((e) => e.tags.some((t: string[]) => t[0] === 't' && t[1] === MYPACE_TAG))
      }

      // スマートフィルタ適用
      events = filterBySmartFilters(events, hideAds, hideNSFW)

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
      kinds, // Kind 1 (short notes) + Kind 30023 (long articles)
      limit,
    }
    if (!showAll) {
      filter['#t'] = [MYPACE_TAG]
    }
    if (since > 0) {
      filter.since = since
    }
    if (until > 0) {
      filter.until = until
    }

    let events = await pool.querySync(RELAYS, filter)
    events.sort((a, b) => b.created_at - a.created_at)

    // スマートフィルタ適用
    events = filterBySmartFilters(events, hideAds, hideNSFW)

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
      SELECT pubkey, name, display_name, picture, about, nip05, banner, website, lud16, emojis
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
        banner: row.banner,
        website: row.website,
        lud16: row.lud16,
        emojis: row.emojis ? JSON.parse(row.emojis as string) : [],
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

      // Group by pubkey and keep only the most recent event
      const latestEvents = new Map<string, (typeof events)[0]>()
      for (const event of events) {
        const existing = latestEvents.get(event.pubkey)
        if (!existing || event.created_at > existing.created_at) {
          latestEvents.set(event.pubkey, event)
        }
      }

      for (const event of latestEvents.values()) {
        try {
          const profile = JSON.parse(event.content)
          // Extract emoji tags (NIP-30)
          const emojis = event.tags
            .filter((t: string[]) => t[0] === 'emoji' && t[1] && t[2])
            .map((t: string[]) => ({ shortcode: t[1], url: t[2] }))
          profiles[event.pubkey] = { ...profile, emojis }

          await db
            .prepare(
              `
            INSERT OR REPLACE INTO profiles (pubkey, name, display_name, picture, about, nip05, banner, website, lud16, emojis, cached_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
            )
            .bind(
              event.pubkey,
              profile.name,
              profile.display_name,
              profile.picture,
              profile.about,
              profile.nip05,
              profile.banner,
              profile.website,
              profile.lud16,
              JSON.stringify(emojis),
              now
            )
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

  const pool = new SimplePool()

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

  const pool = new SimplePool()

  try {
    // Kind 1 (short notes) + Kind 30023 (long articles) as replies
    const events = await pool.querySync(RELAYS, { kinds: [1, 30023], '#e': [eventId] })
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
  const since = Number(c.req.query('since')) || 0
  const until = Number(c.req.query('until')) || 0

  const pool = new SimplePool()

  try {
    const filter: Filter = {
      kinds: [1, 30023], // Kind 1 (short notes) + Kind 30023 (long articles)
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
    return c.json({ error: 'Invalid event: missing id or sig' }, 400)
  }

  const pool = new SimplePool()

  try {
    // Try to publish and collect results
    const publishResults = pool.publish(RELAYS, event)
    const results = await Promise.allSettled(publishResults)

    // Check results for each relay
    const relayResults = results.map((r, i) => ({
      relay: RELAYS[i],
      success: r.status === 'fulfilled',
      error: r.status === 'rejected' ? String(r.reason) : null,
    }))

    const successCount = relayResults.filter((r) => r.success).length
    const failedRelays = relayResults.filter((r) => !r.success)

    // Log all results for debugging
    console.log('Publish results:', JSON.stringify(relayResults))

    if (successCount === 0) {
      console.error('All relays rejected:', failedRelays)
      return c.json({ error: 'All relays rejected the event', details: failedRelays }, 500)
    }

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

    return c.json({
      success: true,
      id: event.id,
      relays: {
        total: RELAYS.length,
        success: successCount,
        details: relayResults,
      },
    })
  } catch (e) {
    console.error('Publish error:', e)
    return c.json({ error: `Failed to publish: ${e instanceof Error ? e.message : 'Unknown error'}` }, 500)
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
    // Validate URL
    new URL(url)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'mypace-bot/1.0 (+https://mypace.pages.dev)',
        Accept: 'text/html',
      },
    })

    if (!response.ok) {
      return c.json({ error: 'Failed to fetch URL' }, 502)
    }

    const html = await response.text()

    // Extract OGP meta tags
    const getMetaContent = (property: string): string | undefined => {
      const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i')
      const match = html.match(regex)
      if (match) return match[1]

      // Try reverse order (content before property)
      const reverseRegex = new RegExp(
        `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
        'i'
      )
      const reverseMatch = html.match(reverseRegex)
      return reverseMatch?.[1]
    }

    const getTitle = (): string | undefined => {
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      return titleMatch?.[1]
    }

    const title = getMetaContent('og:title') || getMetaContent('twitter:title') || getTitle()
    const description =
      getMetaContent('og:description') || getMetaContent('twitter:description') || getMetaContent('description')
    const image = getMetaContent('og:image') || getMetaContent('twitter:image')
    const siteName = getMetaContent('og:site_name')

    return c.json({
      title,
      description,
      image,
      siteName,
    })
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

// GET /.well-known/nostr.json - NIP-05認証エンドポイント
app.get('/.well-known/nostr.json', async (c) => {
  const db = c.env.DB
  const name = c.req.query('name')

  if (!name) {
    return c.json({ error: 'Name parameter required' }, 400)
  }

  try {
    // データベースから指定された名前のプロフィールを検索
    const result = await db
      .prepare(
        `
        SELECT pubkey, name FROM profiles 
        WHERE name = ? AND nip05 LIKE ?
      `
      )
      .bind(name, `${name}@%`)
      .first()

    if (!result) {
      return c.json({ names: {} })
    }

    // NIP-05フォーマットで返す
    return c.json({
      names: {
        [name]: result.pubkey,
      },
    })
  } catch (e) {
    console.error('NIP-05 lookup error:', e)
    return c.json({ error: 'Failed to lookup NIP-05' }, 500)
  }
})

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

export default app
