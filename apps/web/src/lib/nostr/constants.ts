export const MYPACE_TAG = 'mypace'
export const APP_TITLE = 'MY PACE'
export const AURORA_TAG = 'aurora'
export const MYPACE_URL = 'https://mypace.llll-ll.com'

// Nostr Event Kinds
export const KIND_NOTE = 1
export const KIND_REPOST = 6
export const KIND_LONG_FORM = 30023
export const KIND_MAGAZINE = 30001 // NIP-51 Public Sets (used for magazines)
export const KIND_SINOV_NPC = 42000 // Sinov NPC posts (hidden from other clients)

// Magazine constants
export const MAGAZINE_TAG = 'mypace-magazine'
export const MAX_MAGAZINE_POSTS = 100

// タイムライン/検索用リレー（#t + NIP-50 search対応）
// relay.nostr.bandは全機能対応だが502エラーのため除外（復旧後に追加検討）
export const SEARCH_RELAYS = ['wss://search.nos.today']

// メタデータ/プロフィール用リレー（#e, authors対応）
export const GENERAL_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol']

// 後方互換用（両方を含む）
export const RELAYS = [...SEARCH_RELAYS, ...GENERAL_RELAYS]

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

// NSFW keywords
export const NSFW_KEYWORDS: string[] = []
