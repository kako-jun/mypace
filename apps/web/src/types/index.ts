// Event type (Nostr event structure)
export interface Event {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

// Emoji type for NIP-30 custom emojis
export interface EmojiTag {
  shortcode: string
  url: string
}

// Profile types
export interface Profile {
  name?: string
  display_name?: string
  picture?: string
  about?: string
  nip05?: string
  banner?: string
  website?: string
  lud16?: string
  emojis?: EmojiTag[]
}

export interface ProfileCache {
  [pubkey: string]: Profile | null
}

// Reaction types
export interface Reactor {
  pubkey: string
  stella: number
  reactionId: string
  createdAt: number
}

export interface ReactionData {
  count: number
  myReaction: boolean
  myStella: number // Number of stella I've given (1-10)
  myReactionId: string | null // ID of my reaction event (for deletion)
  reactors: Reactor[] // List of who gave stella
}

// Reply types
export interface ReplyData {
  count: number
  replies: Event[]
}

// Repost types
export interface RepostData {
  count: number
  myRepost: boolean
}

// Timeline types
export interface TimelineItem {
  event: Event
  repostedBy?: {
    pubkey: string
    timestamp: number
  }
}

// Theme types
export interface ThemeColors {
  topLeft: string
  topRight: string
  bottomLeft: string
  bottomRight: string
}

// Filter types
export type FilterMode = 'and' | 'or'

export interface SearchFilters {
  query: string // OK word
  ngWords: string[] // NG words
  tags: string[] // OK tags (include posts with these hashtags)
  ngTags: string[] // NG tags (exclude posts with these hashtags)
  mode: FilterMode // AND/OR for tags
  showSNS: boolean // Show kind 1 (short notes)
  showBlog: boolean // Show kind 30023 (long-form articles)
  mypace: boolean // mypace filter (#mypace tag only)
  lang: string // Language code (empty = all)
  // Smart filters (server-side)
  hideAds: boolean // Hide advertisements/spam
  hideNSFW: boolean // Hide adult content
}

// Filter preset types
export interface FilterPreset {
  id: string // UUID
  name: string // User-specified name
  filters: SearchFilters
  createdAt: number // timestamp
}
