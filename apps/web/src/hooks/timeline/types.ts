import type { Event, ProfileCache, ReactionData, ReplyData, RepostData, TimelineItem } from '../../types'

// ギャップ情報を表す型
export interface GapInfo {
  id: string // ユニークID
  afterEventId: string // このイベントの後にギャップがある
  since: number // ギャップの開始時刻（古い側）
  until: number // ギャップの終了時刻（新しい側）
}

export interface UseTimelineOptions {
  authorPubkey?: string // 特定ユーザーの投稿のみ取得
  mypaceOnly?: boolean // mypaceタグでフィルタリング（デフォルト: true）
  showSNS?: boolean // Show kind 1 (short notes) (デフォルト: true)
  showBlog?: boolean // Show kind 30023 (long-form articles) (デフォルト: true)
  hideAds?: boolean // Hide ad/spam content (デフォルト: true)
  hideNSFW?: boolean // Hide NSFW content (デフォルト: true)
  lang?: string // Language filter (デフォルト: '')
}

export interface UseTimelineResult {
  items: TimelineItem[]
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
  newEventCount: number
  gaps: GapInfo[]
  hasMore: boolean
  loadingMore: boolean
  loadingGap: string | null
  reload: () => void
  loadNewEvents: () => void
  loadOlderEvents: () => Promise<void>
  fillGap: (gapId: string) => Promise<void>
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
  oldestEventTime: number
  gaps: GapInfo[]
  hasMore: boolean
  loadingMore: boolean
  loadingGap: string | null
}
