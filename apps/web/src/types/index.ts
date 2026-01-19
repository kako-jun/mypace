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

// Website entry for multiple URLs
export interface WebsiteEntry {
  url: string
  label?: string
}

// Profile types
export interface Profile {
  name?: string
  display_name?: string
  picture?: string
  about?: string
  nip05?: string
  banner?: string
  website?: string // 互換性のため維持（他クライアント用）
  websites?: WebsiteEntry[] // 複数URL（MY PACE拡張）
  lud16?: string
  emojis?: EmojiTag[]
}

export interface ProfileCache {
  [pubkey: string]: Profile | null
}

// Profile that may be loading (undefined), not found (null), or loaded (Profile)
export type LoadableProfile = Profile | null | undefined

// Map of profiles that may be in various loading states
export type ProfileMap = Record<string, LoadableProfile>

// Stella counts per color
export interface StellaCountsByColor {
  yellow: number
  green: number
  red: number
  blue: number
  purple: number
}

// Reaction types
export interface Reactor {
  pubkey: string
  stella: StellaCountsByColor // Stella counts per color
  reactionId: string
  createdAt: number
}

export interface ReactionData {
  myReaction: boolean
  myStella: StellaCountsByColor // My stella per color
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

// View count types
export interface ViewCountData {
  impression: number
  detail: number
}

// Timeline types
export interface TimelineItem {
  event: Event
  repostedBy?: {
    pubkey: string
    timestamp: number
  }
  originalEvent?: Event // リポスト元イベント（kind:6の場合にセット）
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
  ngWords: string[] // NG words
  ngTags: string[] // NG tags (exclude posts with these hashtags)
  showSNS: boolean // Show kind 1 (short notes)
  showBlog: boolean // Show kind 30023 (long-form articles)
  mypace: boolean // mypace filter (#mypace tag only)
  lang: string // Language code (empty = all)
  // Smart filters (server-side)
  hideAds: boolean // Hide advertisements/spam
  hideNSFW: boolean // Hide adult content
  hideNPC: boolean // Hide NPC posts (kind 42000)
}

// Filter preset types
export interface FilterPreset {
  id: string // UUID
  name: string // User-specified name
  filters: SearchFilters
  createdAt: number // timestamp
}

// OGP data types
export interface OgpData {
  title?: string
  description?: string
  image?: string
  siteName?: string
}

// Sticker types
export type StickerQuadrant = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export type StickerLayer = 'front' | 'back'

export interface Sticker {
  url: string // Image URL
  x: number // Position within quadrant (0-100%)
  y: number // Position within quadrant (0-100%)
  size: number // Width (5-100%)
  rotation: number // Rotation angle (0-360 degrees)
  quadrant: StickerQuadrant // Anchor corner for positioning
  layer?: StickerLayer // back (default, behind text) or front
}
