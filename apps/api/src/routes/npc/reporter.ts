import { Hono } from 'hono'
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure'
import { hexToBytes } from 'nostr-tools/utils'
import type { Bindings } from '../../types'
import { getCurrentTimestamp, hashUrl, isValidUrl } from '../../utils'
import { TIMEOUT_MS_FETCH, GENERAL_RELAYS, TIMEOUT_MS_RELAY, MYPACE_TAG } from '../../constants'

const reporter = new Hono<{ Bindings: Bindings }>()

// Quote post tag for identification
const QUOTE_TAG = 'mypace-quote'

// OGP data interface
interface OgpData {
  title?: string
  description?: string
  image?: string
}

// Extract OGP from HTML
function extractOgpFromHtml(html: string): OgpData {
  const getMetaContent = (property: string): string | undefined => {
    const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i')
    const match = html.match(regex)
    if (match) return match[1]

    const reverseRegex = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`, 'i')
    const reverseMatch = html.match(reverseRegex)
    return reverseMatch?.[1]
  }

  const getTitle = (): string | undefined => {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    return titleMatch?.[1]
  }

  return {
    title: getMetaContent('og:title') || getMetaContent('twitter:title') || getTitle(),
    description:
      getMetaContent('og:description') || getMetaContent('twitter:description') || getMetaContent('description'),
    image: getMetaContent('og:image') || getMetaContent('twitter:image'),
  }
}

// Fetch OGP data from URL
async function fetchOgp(url: string): Promise<OgpData | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS_FETCH)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'mypace-bot/1.0 (+https://mypace.llll-ll.com)',
        Accept: 'text/html',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId))

    if (!response.ok) return null

    const html = await response.text()
    return extractOgpFromHtml(html)
  } catch {
    return null
  }
}

// Publish event to relays
async function publishToRelays(event: {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}): Promise<boolean> {
  const relays = GENERAL_RELAYS.slice(0, 2) // Use first 2 relays

  const publishPromises = relays.map(async (relay) => {
    try {
      const ws = new WebSocket(relay)

      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          ws.close()
          resolve(false)
        }, TIMEOUT_MS_RELAY)

        ws.addEventListener('open', () => {
          ws.send(JSON.stringify(['EVENT', event]))
        })

        ws.addEventListener('message', (msg) => {
          try {
            const data = JSON.parse(msg.data as string)
            if (data[0] === 'OK' && data[1] === event.id) {
              clearTimeout(timeout)
              ws.close()
              resolve(data[2] === true)
            }
          } catch {
            // Ignore parse errors
          }
        })

        ws.addEventListener('error', () => {
          clearTimeout(timeout)
          ws.close()
          resolve(false)
        })
      })
    } catch {
      return false
    }
  })

  const results = await Promise.all(publishPromises)
  return results.some((r) => r)
}

// GET /api/npc/reporter - Find existing quote for URL
reporter.get('/', async (c) => {
  const url = c.req.query('url')

  if (!url || !isValidUrl(url)) {
    return c.json({ error: 'invalid_url', message: 'URL is required and must be valid' }, 400)
  }

  const db = c.env.DB
  const urlHash = await hashUrl(url)

  try {
    const existing = await db
      .prepare(
        'SELECT event_json, ogp_title, ogp_description, ogp_image, reply_count FROM article_quotes WHERE url_hash = ?'
      )
      .bind(urlHash)
      .first<{
        event_json: string
        ogp_title: string | null
        ogp_description: string | null
        ogp_image: string | null
        reply_count: number
      }>()

    if (existing) {
      return c.json({
        found: true,
        event: JSON.parse(existing.event_json),
        metadata: {
          title: existing.ogp_title,
          description: existing.ogp_description,
          image: existing.ogp_image,
          replyCount: existing.reply_count,
        },
      })
    }

    return c.json({ found: false })
  } catch (e) {
    console.error('Reporter GET error:', e)
    return c.json({ error: 'internal_error', message: 'Failed to query database' }, 500)
  }
})

// POST /api/npc/reporter - Create new quote post
reporter.post('/', async (c) => {
  const body = await c.req.json<{ url: string }>()
  const url = body.url

  if (!url || !isValidUrl(url)) {
    return c.json({ error: 'invalid_url', message: 'URL is required and must be valid' }, 400)
  }

  // Check if reporter is configured
  const sk = c.env.REPORTER_SECRET_KEY
  if (!sk) {
    return c.json({ error: 'reporter_not_configured', message: 'Reporter account is not configured' }, 500)
  }

  const db = c.env.DB
  const urlHash = await hashUrl(url)
  const now = getCurrentTimestamp()

  try {
    // Check if already exists
    const existing = await db
      .prepare(
        'SELECT event_id, event_json, ogp_title, ogp_description, ogp_image FROM article_quotes WHERE url_hash = ?'
      )
      .bind(urlHash)
      .first<{
        event_id: string
        event_json: string
        ogp_title: string | null
        ogp_description: string | null
        ogp_image: string | null
      }>()

    if (existing) {
      return c.json(
        {
          error: 'already_exists',
          eventId: existing.event_id,
          event: JSON.parse(existing.event_json),
          metadata: {
            title: existing.ogp_title,
            description: existing.ogp_description,
            image: existing.ogp_image,
          },
        },
        409
      )
    }

    // Fetch OGP
    const ogp = await fetchOgp(url)
    if (!ogp || !ogp.title) {
      return c.json({ error: 'ogp_fetch_failed', message: 'Failed to fetch OGP data or no title found' }, 400)
    }

    // Create event
    const pk = getPublicKey(hexToBytes(sk))
    const content = `📰 ${ogp.title}\n\nこの記事について感想をリプライしよう！\n\n${url}`

    const eventTemplate = {
      kind: 1,
      pubkey: pk,
      created_at: now,
      tags: [
        ['t', MYPACE_TAG],
        ['t', QUOTE_TAG],
        ['client', 'mypace'],
        ['r', url],
        ['url-hash', urlHash],
        ['ogp:title', ogp.title],
        ['ogp:description', ogp.description || ''],
        ['ogp:image', ogp.image || ''],
      ],
      content,
    }

    const signedEvent = finalizeEvent(eventTemplate, hexToBytes(sk))

    // Publish to relays
    const published = await publishToRelays(signedEvent)
    if (!published) {
      console.error('Failed to publish to any relay')
      // Continue anyway - save to D1 for retry later
    }

    // Save to D1
    await db
      .prepare(
        `INSERT INTO article_quotes (url_hash, url, event_id, event_json, ogp_title, ogp_description, ogp_image, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        urlHash,
        url,
        signedEvent.id,
        JSON.stringify(signedEvent),
        ogp.title,
        ogp.description || null,
        ogp.image || null,
        now,
        now
      )
      .run()

    return c.json({
      success: true,
      event: signedEvent,
      metadata: {
        title: ogp.title,
        description: ogp.description,
        image: ogp.image,
      },
    })
  } catch (e) {
    console.error('Reporter POST error:', e)
    return c.json(
      {
        error: 'internal_error',
        message: `Failed to create quote: ${e instanceof Error ? e.message : 'Unknown error'}`,
      },
      500
    )
  }
})

export default reporter
