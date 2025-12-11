import { createRoute } from 'honox/factory'
import { SimplePool } from 'nostr-tools'
import { useWebSocketImplementation } from 'nostr-tools/pool'
import { getCachedEvents, cacheEvents } from '../../lib/db/cache'
import { MYPACE_TAG } from '../../lib/nostr/constants'
import { RELAYS } from '../../lib/nostr/relay'

// Setup WebSocket with SOCKS5 proxy support for server-side
async function setupWebSocket() {
  // Only run on server-side (Node.js)
  if (typeof window !== 'undefined') return

  // Load .env file
  const dotenv = await import('dotenv')
  dotenv.config()

  const proxyUrl = process.env.SOCKS5_PROXY
  const WebSocket = (await import('ws')).default

  if (proxyUrl) {
    const { SocksProxyAgent } = await import('socks-proxy-agent')
    const agent = new SocksProxyAgent(proxyUrl)

    // Create a WebSocket class that uses the proxy agent
    class ProxiedWebSocket extends WebSocket {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols, { agent })
      }
    }
    useWebSocketImplementation(ProxiedWebSocket as unknown as typeof globalThis.WebSocket)
  } else {
    useWebSocketImplementation(WebSocket as unknown as typeof globalThis.WebSocket)
  }
}

export default createRoute(async (c) => {
  const db = c.env?.DB
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100)

  // Try cache first
  if (db) {
    try {
      const cached = await getCachedEvents(db, 1, limit)
      if (cached && cached.length > 0) {
        return c.json({ events: cached, source: 'cache' })
      }
    } catch (e) {
      console.error('Cache read error:', e)
    }
  }

  // Setup WebSocket implementation (with optional proxy)
  await setupWebSocket()

  // Fetch from relays (only mypace-tagged posts)
  const pool = new SimplePool()
  try {
    const events = await pool.querySync(RELAYS, {
      kinds: [1],
      '#t': [MYPACE_TAG],
      limit,
    })

    const sorted = events.sort((a, b) => b.created_at - a.created_at)

    // Cache results
    if (db && sorted.length > 0) {
      try {
        await cacheEvents(db, sorted)
      } catch (e) {
        console.error('Cache write error:', e)
      }
    }

    return c.json({ events: sorted, source: 'relay' })
  } finally {
    pool.close(RELAYS)
  }
})
