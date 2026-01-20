import type { D1Database } from '@cloudflare/workers-types'
import { getCurrentTimestamp } from '../utils'

// OGPキャッシュのクリーンアップ
export async function cleanupOgpCache(db: D1Database): Promise<void> {
  const nowSeconds = getCurrentTimestamp()

  try {
    await db.prepare('DELETE FROM ogp_cache WHERE expires_at < ?').bind(nowSeconds).run()
  } catch (e) {
    console.error('OGP cache cleanup error:', e)
  }
}
