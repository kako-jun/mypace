import type { D1Database } from '@cloudflare/workers-types'

export type Bindings = {
  DB: D1Database
}

export type CachedEvent = {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

export type CachedProfile = {
  pubkey: string
  name?: string
  display_name?: string
  picture?: string
  about?: string
  nip05?: string
  banner?: string
  website?: string
  websites?: string[]
  lud16?: string
  emojis?: Array<{ shortcode: string; url: string }>
}
