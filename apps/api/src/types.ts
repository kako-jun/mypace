import type { D1Database } from '@cloudflare/workers-types'

export type Bindings = {
  DB: D1Database
  DISABLE_CACHE?: string // '1' to disable OGP cache
  RELAY_COUNT?: string // リレー数（0=リレー接続しない、デフォルト=ALL_RELAYS.length）
  // VAPID keys for Web Push
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_SUBJECT?: string // mailto:xxx or https://xxx
}
