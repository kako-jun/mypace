import type { D1Database } from '@cloudflare/workers-types'

// OGPキャッシュのクリーンアップ
export async function cleanupOgpCache(db: D1Database): Promise<void> {
  const nowSeconds = Math.floor(Date.now() / 1000)

  try {
    await db.prepare('DELETE FROM ogp_cache WHERE expires_at < ?').bind(nowSeconds).run()
  } catch (e) {
    console.error('OGP cache cleanup error:', e)
  }
}
