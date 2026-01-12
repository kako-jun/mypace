import { Hono } from 'hono'
import { Relay } from 'nostr-tools/relay'
import type { Bindings } from '../types'
import { KIND_NOTE, KIND_LONG_FORM } from '../constants'

// NIP-45をサポートするリレー
const COUNT_RELAY = 'wss://relay.nostr.band'

const userCount = new Hono<{ Bindings: Bindings }>()

// nostr-tools の Relay.count() を使用
async function fetchCount(pubkey: string, kinds: number[]): Promise<{ count: number | null; error?: string }> {
  let relay: Relay | null = null
  try {
    relay = await Relay.connect(COUNT_RELAY)
    const count = await relay.count([{ kinds, authors: [pubkey] }], {})
    return { count }
  } catch (e) {
    return { count: null, error: String(e) }
  } finally {
    relay?.close()
  }
}

// GET /api/user/:pubkey/count - ユーザーの投稿数を取得
userCount.get('/:pubkey/count', async (c) => {
  const pubkey = c.req.param('pubkey')

  if (!pubkey || pubkey.length !== 64) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  const result = await fetchCount(pubkey, [KIND_NOTE, KIND_LONG_FORM])

  return c.json(result)
})

export default userCount
