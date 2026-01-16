import type { D1Database } from '@cloudflare/workers-types'

export type Bindings = {
  DB: D1Database
  DISABLE_CACHE?: string // '1' to disable OGP cache
  RELAY_COUNT?: string // リレー数（0=リレー接続しない、デフォルト=ALL_RELAYS.length）
}
