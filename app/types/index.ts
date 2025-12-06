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

// Theme types
export interface ThemeColors {
  topLeft: string
  topRight: string
  bottomLeft: string
  bottomRight: string
}

export const DEFAULT_THEME_COLORS: ThemeColors = {
  topLeft: '#ffffff',
  topRight: '#ffffff',
  bottomLeft: '#ff9999',
  bottomRight: '#ff9999'
}

// Filter types
export type FilterMode = 'and' | 'or'
