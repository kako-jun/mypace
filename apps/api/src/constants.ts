// Nostr
export const MYPACE_TAG = 'mypace'
export const STELLA_TAG = 'stella'

// Stella colors
export const STELLA_COLORS = ['yellow', 'green', 'red', 'blue', 'purple'] as const
export type StellaColor = (typeof STELLA_COLORS)[number]

// Supernova thresholds for cumulative achievements
export const STELLA_THRESHOLDS = [10, 100, 1000] as const

// Notification limits
export const MAX_NOTIFICATIONS = 50
export const AGGREGATED_NOTIFICATIONS_LIMIT = 20

// Cache TTLs (in seconds)
export const CACHE_TTL_OGP = 86400 // 24 hours

// Web Push TTLs (in seconds)
export const VAPID_JWT_EXPIRATION = 12 * 60 * 60 // 12 hours
export const PUSH_TTL = 86400 // 24 hours

// API timeouts (in milliseconds)
export const TIMEOUT_MS_RELAY = 10000
export const TIMEOUT_MS_FETCH = 5000

// Batch limits
export const OGP_BATCH_LIMIT = 50

// Pagination defaults
export const PAGINATION_DEFAULT_LIMIT = 20
export const PAGINATION_MAX_LIMIT = 100

// Nostr Event Kinds
export const KIND_NOTE = 1
export const KIND_LONG_FORM = 30023
export const KIND_SINOV_NPC = 42000 // Sinov NPC posts (hidden from other clients)
export const KIND_MAGAZINE = 30001 // NIP-51 Public Sets (used for magazines)

// Magazine
export const MAGAZINE_TAG = 'mypace-magazine'

// 全リレーリスト（環境変数RELAY_COUNTで使用数を制御）
export const ALL_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social',
]

// General relays for non-timeline queries
export const GENERAL_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

export const CACHE_CLEANUP_PROBABILITY = 0.01 // 1%の確率でOGPキャッシュクリーンアップ

// Smart filter: Ad-related tags
export const AD_TAGS = [
  'bitcoin',
  'btc',
  'crypto',
  'eth',
  'ethereum',
  'airdrop',
  'nft',
  'ad',
  'sponsored',
  'giveaway',
  'promo',
]

// Ad keywords (控えめに - 明らかなスパムフレーズのみ)
export const AD_KEYWORDS = ['airdrop', 'giveaway', 'free btc', 'free bitcoin']

// Smart filter: NSFW-related tags (NIP-36準拠の投稿者が自己申告で使うタグ)
export const NSFW_TAGS = [
  'nsfw',
  'r18',
  'r-18',
  'adult',
  'sensitive',
  'nude',
  'porn',
  'xxx',
  'hentai',
  'content-warning',
]

// NSFW keywords (明示的な性的用語 - スパマーが頻繁に使用するキーワード)
export const NSFW_KEYWORDS: string[] = []
