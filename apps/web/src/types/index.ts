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
  stars: number
  reactionId: string
  createdAt: number
}

export interface ReactionData {
  count: number
  myReaction: boolean
  myStars: number // Number of stars I've given (1-100)
  myReactionId: string | null // ID of my reaction event (for deletion)
  reactors: Reactor[] // List of who gave stars
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
