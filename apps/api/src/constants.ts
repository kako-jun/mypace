// Nostr
export const MYPACE_TAG = 'mypace'
export const STELLA_TAG = 'stella'

export const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social',
]

export const CACHE_TTL_MS = 10 * 1000 // 10秒

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

// NSFW keywords (使わない - 責任ある投稿者が警告として書く言葉であり、実際のスパマーは使わない)
export const NSFW_KEYWORDS: string[] = []
