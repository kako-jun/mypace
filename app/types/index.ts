import type { Event } from 'nostr-tools'

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

export interface ReactionCache {
  [eventId: string]: ReactionData
}

// Reply types
export interface ReplyData {
  count: number
  replies: Event[]
}

export interface ReplyCache {
  [eventId: string]: ReplyData
}

// Repost types
export interface RepostData {
  count: number
  myRepost: boolean
}

export interface RepostCache {
  [eventId: string]: RepostData
}

// Timeline types
export interface TimelineItem {
  event: Event
  repostedBy?: {
    pubkey: string
    timestamp: number
  }
}

export interface TimelineData {
  items: TimelineItem[]
  events: Event[]
  profiles: ProfileCache
  reactions: { [eventId: string]: ReactionData }
  replies: { [eventId: string]: ReplyData }
  reposts: { [eventId: string]: RepostData }
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
