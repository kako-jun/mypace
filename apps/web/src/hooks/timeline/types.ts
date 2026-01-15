import type { Event, ProfileCache, ReactionData, ReplyData, RepostData, ViewCountData, TimelineItem } from '../../types'

export interface UseTimelineOptions {
  authorPubkey?: string // 特定ユーザーの投稿のみ取得（ユーザーページ用）
  tags?: string[] // ハッシュタグフィルタ（ユーザーページ用）
  q?: string[] // テキスト検索クエリ（ユーザーページ用）
}

export interface UseTimelineResult {
  items: TimelineItem[]
  events: Event[]
  profiles: ProfileCache
  reactions: { [eventId: string]: ReactionData }
  replies: { [eventId: string]: ReplyData }
  reposts: { [eventId: string]: RepostData }
  views: { [eventId: string]: ViewCountData }
  myPubkey: string | null
  loading: boolean
  error: string
  likingId: string | null
  repostingId: string | null
  newEventCount: number
  hasMore: boolean
  loadingMore: boolean
  reload: () => void
  loadNewEvents: () => void
  loadOlderEvents: () => Promise<void>
  handleLike: (event: Event) => void
  handleUnlike: (event: Event) => Promise<void>
  handleRepost: (event: Event) => Promise<void>
  handleDelete: (event: Event) => Promise<void>
  getDisplayName: (pubkey: string) => string
  getAvatarUrl: (pubkey: string) => string | null
}

export interface TimelineState {
  timelineItems: TimelineItem[]
  events: Event[]
  profiles: ProfileCache
  reactions: { [eventId: string]: ReactionData }
  replies: { [eventId: string]: ReplyData }
  reposts: { [eventId: string]: RepostData }
  myPubkey: string | null
  loading: boolean
  error: string
  likingId: string | null
  repostingId: string | null
  pendingNewEvents: Event[]
  latestEventTime: number
  hasMore: boolean
  loadingMore: boolean
}
