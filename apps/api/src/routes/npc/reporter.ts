import { Hono } from 'hono'
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure'
import { nip19 } from 'nostr-tools'
import type { Bindings } from '../../types'
import { getCurrentTimestamp, normalizeUrl, isValidUrl } from '../../utils'
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

// Nostr event interface
interface NostrEvent {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
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

// Query relays for existing quote by reporter pubkey and URL
async function findExistingQuote(reporterPubkey: string, normalizedUrl: string): Promise<NostrEvent | null> {
  const relay = GENERAL_RELAYS[0] // Use first relay for queries

  try {
    const ws = new WebSocket(relay)

    return new Promise<NostrEvent | null>((resolve) => {
      const events: NostrEvent[] = []
      const timeout = setTimeout(() => {
        ws.close()
        resolve(events.length > 0 ? events[0] : null)
      }, TIMEOUT_MS_RELAY)

      ws.addEventListener('open', () => {
        // Query for reporter's posts with the 'r' tag matching the URL
        const filter = {
          authors: [reporterPubkey],
          kinds: [1],
          '#r': [normalizedUrl],
          '#t': [QUOTE_TAG],
          limit: 1,
        }
        ws.send(JSON.stringify(['REQ', 'quote-search', filter]))
      })

      ws.addEventListener('message', (msg) => {
        try {
          const data = JSON.parse(msg.data as string)
          if (data[0] === 'EVENT' && data[1] === 'quote-search') {
            events.push(data[2] as NostrEvent)
          } else if (data[0] === 'EOSE' && data[1] === 'quote-search') {
            clearTimeout(timeout)
            ws.close()
            resolve(events.length > 0 ? events[0] : null)
          }
        } catch {
          // Ignore parse errors
        }
      })

      ws.addEventListener('error', () => {
        clearTimeout(timeout)
        ws.close()
        resolve(null)
      })
    })
  } catch {
    return null
  }
}

// Publish event to relays
async function publishToRelays(event: NostrEvent): Promise<boolean> {
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

// Extract OGP metadata from event tags
function extractOgpFromEvent(event: NostrEvent): OgpData {
  const getTagValue = (name: string): string | undefined => {
    const tag = event.tags.find((t) => t[0] === name)
    return tag?.[1]
  }

  return {
    title: getTagValue('ogp:title'),
    description: getTagValue('ogp:description'),
    image: getTagValue('ogp:image'),
  }
}

// GET /api/npc/reporter - Find existing quote for URL
reporter.get('/', async (c) => {
  const url = c.req.query('url')

  if (!url || !isValidUrl(url)) {
    return c.json({ error: 'invalid_url', message: 'URL is required and must be valid' }, 400)
  }

  // Check if reporter is configured
  const nsec = c.env.REPORTER_NSEC
  if (!nsec) {
    return c.json({ error: 'reporter_not_configured', message: 'Reporter account is not configured' }, 500)
  }

  const { data: sk } = nip19.decode(nsec)
  const pk = getPublicKey(sk as Uint8Array)
  const normalized = normalizeUrl(url)

  try {
    const existingEvent = await findExistingQuote(pk, normalized)

    if (existingEvent) {
      const ogp = extractOgpFromEvent(existingEvent)
      return c.json({
        found: true,
        event: existingEvent,
        metadata: {
          title: ogp.title || null,
          description: ogp.description || null,
          image: ogp.image || null,
        },
      })
    }

    return c.json({ found: false })
  } catch (e) {
    console.error('Reporter GET error:', e)
    return c.json({ error: 'internal_error', message: 'Failed to query relays' }, 500)
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
  const nsec = c.env.REPORTER_NSEC
  if (!nsec) {
    return c.json({ error: 'reporter_not_configured', message: 'Reporter account is not configured' }, 500)
  }

  const { data: sk } = nip19.decode(nsec)
  const pk = getPublicKey(sk as Uint8Array)
  const normalized = normalizeUrl(url)
  const now = getCurrentTimestamp()

  try {
    // Check if already exists on relays
    const existingEvent = await findExistingQuote(pk, normalized)

    if (existingEvent) {
      const ogp = extractOgpFromEvent(existingEvent)
      return c.json({
        found: true,
        message: 'Quote already exists for this article',
        event: existingEvent,
        metadata: {
          title: ogp.title || null,
          description: ogp.description || null,
          image: ogp.image || null,
        },
      })
    }

    // Fetch OGP
    const ogp = await fetchOgp(url)
    if (!ogp || !ogp.title) {
      return c.json({ error: 'ogp_fetch_failed', message: 'Failed to fetch OGP data or no title found' }, 400)
    }

    // Create event
    const isNonEnglishTitle = /[^\x20-\x7E]/.test(ogp.title)
    const prompt = isNonEnglishTitle
      ? 'リプライであなたの感想を聞かせてください'
      : 'Share your thoughts in the replies!'
    const content = `${prompt}\n\n${ogp.title}\n${url}`

    const eventTemplate = {
      kind: 1,
      pubkey: pk,
      created_at: now,
      tags: [
        ['t', MYPACE_TAG],
        ['t', QUOTE_TAG],
        ['client', 'mypace'],
        ['r', normalized],
        ['ogp:title', ogp.title],
        ['ogp:description', ogp.description || ''],
        ['ogp:image', ogp.image || ''],
      ],
      content,
    }

    const signedEvent = finalizeEvent(eventTemplate, sk as Uint8Array)

    // Publish to relays
    const published = await publishToRelays(signedEvent)
    if (!published) {
      return c.json({ error: 'publish_failed', message: 'Failed to publish to relays' }, 500)
    }

    return c.json({
      created: true,
      event: signedEvent,
      metadata: {
        title: ogp.title,
        description: ogp.description || null,
        image: ogp.image || null,
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
