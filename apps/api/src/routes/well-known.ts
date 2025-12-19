import { Hono } from 'hono'
import type { Bindings } from '../types'

const wellKnown = new Hono<{ Bindings: Bindings }>()

// GET /.well-known/nostr.json - NIP-05認証エンドポイント
wellKnown.get('/nostr.json', async (c) => {
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

export default wellKnown
