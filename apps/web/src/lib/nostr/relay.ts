// 直接Nostrリレーに接続してデータを取得
import { SimplePool } from 'nostr-tools/pool'
import type { Filter, Event as NostrEvent } from 'nostr-tools'
import { RELAYS, MYPACE_TAG, KIND_NOTE, KIND_REPOST, KIND_LONG_FORM, KIND_SINOV_NPC } from './constants'
import { parseStellaTags, getTotalStellaCount, EMPTY_STELLA_COUNTS, type StellaCountsByColor } from './events'
import {
  filterBySmartFilters,
  filterByNPC,
  filterByMuteList,
  filterByNgWords,
  filterByNgTags,
  filterByOkTags,
  filterByLanguage,
} from './filters'
import type { Event, Profile, ReactionData, ReplyData, RepostData } from '../../types'

// グローバルプール（再利用）
let pool: SimplePool | null = null

function getPool(): SimplePool {
  if (!pool) {
    pool = new SimplePool()
  }
  return pool
}

// NostrEvent を Event 型に変換
function toEvent(e: NostrEvent): Event {
  return {
    id: e.id,
    pubkey: e.pubkey,
    created_at: e.created_at,
    kind: e.kind,
    tags: e.tags,
    content: e.content,
    sig: e.sig,
  }
}

// リポストイベント（kind:6）から元イベントをパース
export function parseRepostEvent(event: Event): Event | null {
  if (event.kind !== KIND_REPOST) return null

  // kind:6のcontentには元イベントのJSONが含まれている
  try {
    if (event.content) {
      const parsed = JSON.parse(event.content)
      // 必須フィールドの検証
      if (
        parsed.id &&
        parsed.pubkey &&
        typeof parsed.created_at === 'number' &&
        typeof parsed.kind === 'number' &&
        Array.isArray(parsed.tags) &&
        typeof parsed.content === 'string' &&
        parsed.sig
      ) {
        return {
          id: parsed.id,
          pubkey: parsed.pubkey,
          created_at: parsed.created_at,
          kind: parsed.kind,
          tags: parsed.tags,
          content: parsed.content,
          sig: parsed.sig,
        }
      }
    }
  } catch {
    // JSONパース失敗時はnullを返す
  }
  return null
}

export interface FetchTimelineOptions {
  limit?: number
  since?: number
  until?: number
  showAll?: boolean
  langFilter?: string
  hideAds?: boolean
  hideNSFW?: boolean
  hideNPC?: boolean
  mutedPubkeys?: string[]
  ngWords?: string[]
  ngTags?: string[]
  queries?: string[]
  okTags?: string[]
  kinds?: number[]
}

export interface FetchTimelineResult {
  events: Event[]
  searchedUntil: number | null
}

// タイムライン取得（直接リレー接続）
export async function fetchTimeline(options: FetchTimelineOptions = {}): Promise<FetchTimelineResult> {
  const {
    limit = 50,
    since = 0,
    until = 0,
    showAll = false,
    langFilter = '',
    hideAds = true,
    hideNSFW = true,
    hideNPC = false,
    mutedPubkeys = [],
    ngWords = [],
    ngTags = [],
    queries = [],
    okTags = [],
    kinds,
  } = options

  const defaultKinds = showAll
    ? [KIND_NOTE, KIND_REPOST, KIND_LONG_FORM]
    : [KIND_NOTE, KIND_REPOST, KIND_LONG_FORM, KIND_SINOV_NPC]
  const targetKinds = kinds ?? defaultKinds

  if (targetKinds.length === 0) {
    return { events: [], searchedUntil: null }
  }

  const p = getPool()

  try {
    // NIP-50: 検索クエリがある場合はリレー側で全文検索
    const searchQuery = queries.filter((q) => q.trim()).join(' ')

    const filter: Filter = {
      kinds: targetKinds,
      limit: limit * 2, // フィルタで減る分を考慮
    }
    // #tフィルタは常に適用（NIP-50対応リレーはsearch+#tの組み合わせを処理できる）
    if (!showAll) {
      filter['#t'] = [MYPACE_TAG]
    }
    if (since > 0) {
      filter.since = since
    }
    if (until > 0) {
      filter.until = until
    }
    if (searchQuery) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(filter as any).search = searchQuery
    }

    const rawEvents = await p.querySync(RELAYS, filter)
    rawEvents.sort((a, b) => b.created_at - a.created_at)

    let events = rawEvents.map(toEvent)

    // クライアント側フィルタ（リレーが対応していないもののみ）
    events = filterByMuteList(events, mutedPubkeys)
    events = filterBySmartFilters(events, hideAds, hideNSFW)
    events = filterByNPC(events, hideNPC)
    events = filterByNgWords(events, ngWords)
    events = filterByNgTags(events, ngTags)
    events = filterByOkTags(events, okTags)

    if (langFilter) {
      events = filterByLanguage(events, langFilter)
    }

    // limit件に切り詰め
    const result = events.slice(0, limit)

    // searchedUntilは「返却するイベントの最古時刻」
    // sliceで切り捨てられたイベントも次回取得できるようにする
    // result が0件の場合はrawEventsの最古を使う（フィルタ後0件でも過去を探れるように）
    const searchedUntil =
      result.length > 0
        ? Math.min(...result.map((e) => e.created_at))
        : rawEvents.length > 0
          ? Math.min(...rawEvents.map((e) => e.created_at))
          : null

    return { events: result, searchedUntil }
  } catch (e) {
    console.error('Failed to fetch timeline:', e)
    return { events: [], searchedUntil: null }
  }
}

export interface FetchUserEventsOptions {
  limit?: number
  since?: number
  until?: number
  showAll?: boolean
  tags?: string[]
  q?: string[]
  langFilter?: string
  hideAds?: boolean
  hideNSFW?: boolean
  hideNPC?: boolean
  mutedPubkeys?: string[]
  ngWords?: string[]
  ngTags?: string[]
  kinds?: number[]
}

export interface FetchUserEventsResult {
  events: Event[]
  searchedUntil: number | null
}

// ユーザー投稿取得（直接リレー接続）
export async function fetchUserEvents(
  pubkey: string,
  options: FetchUserEventsOptions = {}
): Promise<FetchUserEventsResult> {
  const {
    limit = 50,
    since = 0,
    until = 0,
    showAll = false,
    tags = [],
    q = [],
    langFilter = '',
    hideAds = true,
    hideNSFW = true,
    hideNPC = false,
    mutedPubkeys = [],
    ngWords = [],
    ngTags = [],
    kinds,
  } = options

  const defaultKinds = showAll
    ? [KIND_NOTE, KIND_REPOST, KIND_LONG_FORM]
    : [KIND_NOTE, KIND_REPOST, KIND_LONG_FORM, KIND_SINOV_NPC]
  const targetKinds = kinds ?? defaultKinds

  if (targetKinds.length === 0) {
    return { events: [], searchedUntil: null }
  }

  const p = getPool()

  try {
    // NIP-50: 検索クエリがある場合はリレー側で全文検索
    const searchQuery = q.filter((query) => query.trim()).join(' ')

    const filter: Filter = {
      kinds: targetKinds,
      authors: [pubkey],
      limit: limit * 2,
    }

    // #tフィルタは常に適用（NIP-50対応リレーはsearch+#tの組み合わせを処理できる）
    if (!showAll || tags.length > 0) {
      const tagFilter = showAll ? tags : [MYPACE_TAG, ...tags]
      if (tagFilter.length > 0) {
        filter['#t'] = tagFilter
      }
    }
    if (since > 0) {
      filter.since = since
    }
    if (until > 0) {
      filter.until = until
    }
    if (searchQuery) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(filter as any).search = searchQuery
    }

    const rawEvents = await p.querySync(RELAYS, filter)
    rawEvents.sort((a, b) => b.created_at - a.created_at)

    let events = rawEvents.map(toEvent)

    // クライアント側フィルタ（リレーが対応していないもののみ）
    events = filterByMuteList(events, mutedPubkeys)
    events = filterBySmartFilters(events, hideAds, hideNSFW)
    events = filterByNPC(events, hideNPC)
    events = filterByNgWords(events, ngWords)
    events = filterByNgTags(events, ngTags)
    events = filterByOkTags(events, tags)

    if (langFilter) {
      events = filterByLanguage(events, langFilter)
    }

    // limit件に切り詰め
    const result = events.slice(0, limit)

    // searchedUntilは「返却するイベントの最古時刻」
    // sliceで切り捨てられたイベントも次回取得できるようにする
    // result が0件の場合はrawEventsの最古を使う（フィルタ後0件でも過去を探れるように）
    const searchedUntil =
      result.length > 0
        ? Math.min(...result.map((e) => e.created_at))
        : rawEvents.length > 0
          ? Math.min(...rawEvents.map((e) => e.created_at))
          : null

    return { events: result, searchedUntil }
  } catch (e) {
    console.error('Failed to fetch user events:', e)
    return { events: [], searchedUntil: null }
  }
}

// プロフィール取得（直接リレー接続）
export async function fetchProfiles(pubkeys: string[]): Promise<Record<string, Profile | null>> {
  if (pubkeys.length === 0) return {}

  const p = getPool()
  const result: Record<string, Profile | null> = {}

  // 初期化
  for (const pk of pubkeys) {
    result[pk] = null
  }

  try {
    const filter: Filter = {
      kinds: [0], // kind:0 = metadata
      authors: pubkeys,
    }

    const events = await p.querySync(RELAYS, filter)

    // 各pubkeyの最新プロフィールを取得
    const latestByPubkey: Record<string, NostrEvent> = {}
    for (const e of events) {
      if (!latestByPubkey[e.pubkey] || e.created_at > latestByPubkey[e.pubkey].created_at) {
        latestByPubkey[e.pubkey] = e
      }
    }

    // プロフィールをパース
    for (const [pk, event] of Object.entries(latestByPubkey)) {
      try {
        const content = JSON.parse(event.content)
        result[pk] = {
          name: content.name,
          display_name: content.display_name,
          picture: content.picture,
          about: content.about,
          nip05: content.nip05,
          banner: content.banner,
          website: content.website,
          websites: content.websites,
          lud16: content.lud16,
        }
      } catch {
        // パース失敗はnullのまま
      }
    }
  } catch (e) {
    console.error('Failed to fetch profiles:', e)
  }

  return result
}

// 単一プロフィール取得
export async function fetchUserProfile(pubkey: string): Promise<Profile | null> {
  const profiles = await fetchProfiles([pubkey])
  return profiles[pubkey] || null
}

// イベントをIDで取得（直接リレー接続）
export async function fetchEventById(eventId: string): Promise<Event | null> {
  const p = getPool()

  try {
    const filter: Filter = {
      ids: [eventId],
    }

    const events = await p.querySync(RELAYS, filter)
    if (events.length > 0) {
      return toEvent(events[0])
    }
    return null
  } catch (e) {
    console.error('Failed to fetch event by ID:', e)
    return null
  }
}

// 複数イベントをIDで取得
export async function fetchEventsByIds(eventIds: string[]): Promise<Record<string, Event>> {
  if (eventIds.length === 0) return {}

  const p = getPool()
  const result: Record<string, Event> = {}

  try {
    const filter: Filter = {
      ids: eventIds,
    }

    const events = await p.querySync(RELAYS, filter)
    for (const e of events) {
      result[e.id] = toEvent(e)
    }
  } catch (e) {
    console.error('Failed to fetch events by IDs:', e)
  }

  return result
}

// 投稿（直接リレー送信 + D1記録）
export async function publishEvent(event: Event): Promise<void> {
  const p = getPool()

  try {
    await Promise.any(p.publish(RELAYS, event as NostrEvent))

    // D1記録が必要なイベントの場合、APIに通知（fire-and-forget）
    // - kind:1 + mypaceタグ → 通し番号登録
    // - kind:1 + eタグ → リプライ通知記録
    // - kind:6 → リポスト通知記録
    // - kind:7 + stellaタグ → ステラ記録
    // - kind:5 → 削除処理
    const needsRecord =
      event.kind === 5 ||
      event.kind === 6 ||
      (event.kind === 7 && event.tags.some((t) => t[0] === 'stella')) ||
      (event.kind === 1 &&
        (event.tags.some((t) => t[0] === 't' && t[1]?.toLowerCase() === MYPACE_TAG) ||
          event.tags.some((t) => t[0] === 'e')))

    if (needsRecord) {
      // 動的インポートでapi.tsを読み込み（循環参照回避）
      import('../api/api').then(({ recordEvent }) => {
        recordEvent(event)
      })
    }
  } catch (e) {
    console.error('Failed to publish event:', e)
    throw e
  }
}

// イベントのメタデータ取得（リアクション、リプライ、リポスト）
export interface EventMetadata {
  reactions: ReactionData
  replies: ReplyData
  reposts: RepostData
}

// stellaタグからカウントと色を取得 (parseStellaTag を使用)

export async function fetchEventMetadata(
  eventIds: string[],
  viewerPubkey?: string
): Promise<Record<string, EventMetadata>> {
  if (eventIds.length === 0) return {}

  const p = getPool()
  const result: Record<string, EventMetadata> = {}

  // 初期化
  for (const id of eventIds) {
    result[id] = {
      reactions: {
        myReaction: false,
        myStella: { ...EMPTY_STELLA_COUNTS },
        myReactionId: null,
        reactors: [],
      },
      replies: { count: 0, replies: [] },
      reposts: { count: 0, myRepost: false },
    }
  }

  try {
    // リアクション（kind:7）、リプライ（kind:1）、リポスト（kind:6）を一括取得
    const filter: Filter = {
      kinds: [7, 1, 6],
      '#e': eventIds,
    }

    const events = await p.querySync(RELAYS, filter)

    // リアクションをイベントごとにグループ化し、ユーザーごとに最新のみ保持
    const reactionsByEvent = new Map<
      string,
      Map<string, { pubkey: string; stella: StellaCountsByColor; reactionId: string; createdAt: number }>
    >()

    for (const e of events) {
      const eTag = e.tags.find((t) => t[0] === 'e')
      const targetId = eTag?.[1]
      if (!targetId || !result[targetId]) continue

      if (e.kind === 7) {
        // リアクション
        if (!reactionsByEvent.has(targetId)) {
          reactionsByEvent.set(targetId, new Map())
        }
        const reactorMap = reactionsByEvent.get(targetId)!
        const existing = reactorMap.get(e.pubkey)
        if (!existing || e.created_at > existing.createdAt) {
          const stellaCounts = parseStellaTags(e.tags)
          reactorMap.set(e.pubkey, {
            pubkey: e.pubkey,
            stella: stellaCounts,
            reactionId: e.id,
            createdAt: e.created_at,
          })
        }
      } else if (e.kind === 1) {
        // リプライ（rootへの返信のみ）
        const eTags = e.tags.filter((t) => t[0] === 'e')
        if (eTags.length === 0) continue
        const rootTag = eTags.find((t) => t[3] === 'root') || eTags[0]
        const replyTargetId = rootTag[1]
        if (result[replyTargetId]) {
          result[replyTargetId].replies.replies.push(toEvent(e))
        }
      } else if (e.kind === 6) {
        // リポスト
        result[targetId].reposts.count++
        if (viewerPubkey && e.pubkey === viewerPubkey) {
          result[targetId].reposts.myRepost = true
        }
      }
    }

    // リアクション結果を構築
    for (const [eventId, reactorMap] of reactionsByEvent) {
      const reactors = Array.from(reactorMap.values()).sort((a, b) => b.createdAt - a.createdAt)
      // totalCount is computed on demand from reactors, not stored
      let myStella: StellaCountsByColor = { ...EMPTY_STELLA_COUNTS }
      let myReactionId: string | null = null
      if (viewerPubkey) {
        const myReaction = reactorMap.get(viewerPubkey)
        if (myReaction) {
          myStella = myReaction.stella
          myReactionId = myReaction.reactionId
        }
      }
      const myReactionExists = getTotalStellaCount(myStella) > 0
      result[eventId].reactions = { myReaction: myReactionExists, myStella, myReactionId, reactors }
    }

    // リプライをソートしてカウント設定
    for (const id of eventIds) {
      result[id].replies.replies.sort((a, b) => a.created_at - b.created_at)
      result[id].replies.count = result[id].replies.replies.length
    }
  } catch (e) {
    console.error('Failed to fetch event metadata:', e)
  }

  return result
}

// エンリッチメント一括取得（md計画通りの関数名）
// - metadata (reactions, replies, reposts) from Nostr
// - profiles from Nostr
// - superMentions from API (D1)
// - views from API (D1) ※追加機能
export interface EnrichResult {
  metadata: Record<string, EventMetadata>
  profiles: Record<string, Profile | null>
  superMentions: Record<string, string>
  views: Record<string, { impression: number; detail: number }>
}

export async function fetchEventsEnrich(
  eventIds: string[],
  authorPubkeys: string[],
  superMentionPaths: string[],
  viewerPubkey?: string
): Promise<EnrichResult> {
  if (eventIds.length === 0) {
    return { metadata: {}, profiles: {}, superMentions: {}, views: {} }
  }

  // 動的インポートで循環参照回避
  const { fetchViewsAndSuperMentions } = await import('../api/api')

  // 並列で取得
  const [metadata, profiles, { views, superMentions }] = await Promise.all([
    fetchEventMetadata(eventIds, viewerPubkey),
    fetchProfiles(authorPubkeys),
    fetchViewsAndSuperMentions(eventIds, superMentionPaths),
  ])

  // profilesをRecord<string, Profile | null>に変換
  const profilesResult: Record<string, Profile | null> = {}
  for (const pk of authorPubkeys) {
    profilesResult[pk] = profiles[pk] || null
  }

  return { metadata, profiles: profilesResult, superMentions, views }
}
