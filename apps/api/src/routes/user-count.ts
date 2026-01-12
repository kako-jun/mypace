import { Hono } from 'hono'
import { Relay } from 'nostr-tools/relay'
import type { Bindings } from '../types'
import { KIND_NOTE, KIND_LONG_FORM } from '../constants'

// NIP-45をサポートするリレー
const COUNT_RELAYS = ['wss://relay.snort.social', 'wss://nostr.wine', 'wss://relay.nostr.band']

const TIMEOUT_MS = 10000

const userCount = new Hono<{ Bindings: Bindings }>()

// タイムアウト付きでPromiseを実行
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}

// GET /api/user/:pubkey/count - ユーザーの投稿数を取得
userCount.get('/:pubkey/count', async (c) => {
  const pubkey = c.req.param('pubkey')

  if (!pubkey || pubkey.length !== 64) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  const errors: string[] = []

  for (const relayUrl of COUNT_RELAYS) {
    let relay: Relay | null = null
    try {
      relay = await withTimeout(Relay.connect(relayUrl), TIMEOUT_MS)
      const count = await withTimeout(
        relay.count([{ kinds: [KIND_NOTE, KIND_LONG_FORM], authors: [pubkey] }], {}),
        TIMEOUT_MS
      )
      return c.json({ count })
    } catch (e) {
      errors.push(`${relayUrl}: ${String(e)}`)
    } finally {
      relay?.close()
    }
  }

  return c.json({ count: null, errors })
})

export default userCount
