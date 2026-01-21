import type {
  Event,
  ProfileCache,
  ReactionData,
  ReplyData,
  RepostData,
  ViewCountData,
  TimelineItem,
  OgpData,
} from '../../types'
import type { StellaColor } from '../../lib/nostr/events'

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
  wikidataMap: Record<string, string>
  ogpMap: Record<string, OgpData>
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
  handleAddStella: (event: Event, color: StellaColor) => void
  handleUnlike: (event: Event, color: StellaColor) => Promise<void>
  handleRepost: (event: Event) => Promise<void>
  handleDelete: (event: Event) => Promise<void>
  getDisplayName: (pubkey: string) => string
  getAvatarUrl: (pubkey: string) => string | null
}
