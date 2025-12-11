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

// Profile types
export interface Profile {
  name?: string
  display_name?: string
  picture?: string
  about?: string
  nip05?: string
}

export interface ProfileCache {
  [pubkey: string]: Profile | null
}

// Reaction types
export interface ReactionData {
  count: number
  myReaction: boolean
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
