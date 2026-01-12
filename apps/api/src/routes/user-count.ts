import { Hono } from 'hono'
import type { Bindings } from '../types'
import { KIND_NOTE, KIND_LONG_FORM } from '../constants'

// NIP-45をサポートするリレー
const COUNT_RELAY = 'wss://relay.nostr.band'

const userCount = new Hono<{ Bindings: Bindings }>()

// Cloudflare Workers用 WebSocket でNIP-45 COUNTリクエストを送信
async function fetchCount(pubkey: string, kinds: number[]): Promise<number | null> {
  try {
    // Cloudflare Workers の WebSocket API
    const resp = await fetch(COUNT_RELAY, {
      headers: {
        Upgrade: 'websocket',
      },
    })

    const ws = resp.webSocket
    if (!ws) {
      return null
    }

    ws.accept()

    const subId = `count-${Date.now()}`

    return new Promise((resolve) => {
      let resolved = false

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          ws.close()
          resolve(null)
        }
      }, 5000)

      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data as string)
          if (data[0] === 'COUNT' && data[1] === subId && data[2]?.count !== undefined) {
            if (!resolved) {
              resolved = true
              clearTimeout(timeout)
              ws.close()
              resolve(data[2].count)
            }
          }
        } catch {
          // ignore parse errors
        }
      })

      ws.addEventListener('error', () => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          ws.close()
          resolve(null)
        }
      })

      // COUNTリクエストを送信
      const filter = { kinds, authors: [pubkey] }
      ws.send(JSON.stringify(['COUNT', subId, filter]))
    })
  } catch {
    return null
  }
}

// GET /api/user/:pubkey/count - ユーザーの投稿数を取得
userCount.get('/:pubkey/count', async (c) => {
  const pubkey = c.req.param('pubkey')

  if (!pubkey || pubkey.length !== 64) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  const count = await fetchCount(pubkey, [KIND_NOTE, KIND_LONG_FORM])

  return c.json({ count })
})

export default userCount
