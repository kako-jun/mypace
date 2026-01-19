import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchTimeline, fetchUserEvents, publishEvent, parseRepostEvent } from '../../lib/nostr/relay'
import { KIND_REPOST } from '../../lib/nostr/constants'
import {
  getCurrentPubkey,
  createDeleteEvent,
  createReactionEvent,
  createRepostEvent,
  MAX_STELLA_PER_USER,
  type StellaColor,
} from '../../lib/nostr/events'
import { getDisplayNameFromCache, getAvatarUrlFromCache, getErrorMessage, getMutedPubkeys } from '../../lib/utils'
import { getFilterSettings } from '../../lib/storage'
import { TIMEOUTS, CUSTOM_EVENTS, LIMITS } from '../../lib/constants'
import { sendToLightningAddress, getStellaCost } from '../../lib/lightning'
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
import type { UseTimelineOptions, UseTimelineResult } from './types'
import { loadEnrichForEvents, recordImpressionsForEvents, loadOgpForEvents } from './useTimelineData'
import { useTimelinePolling } from './useTimelinePolling'

export type { UseTimelineOptions, UseTimelineResult }

// イベントをTimelineItemに変換（リポストの場合はoriginalEventをセット）
function eventsToTimelineItems(events: Event[]): { items: TimelineItem[]; originalEvents: Event[] } {
  const items: TimelineItem[] = []
  const originalEvents: Event[] = []

  for (const event of events) {
    if (event.kind === KIND_REPOST) {
      const originalEvent = parseRepostEvent(event)
      if (originalEvent) {
        items.push({ event, originalEvent })
        originalEvents.push(originalEvent)
      } else {
        // オリジナルイベントがパースできない場合はスキップ
        // （contentが空の場合など）
      }
    } else {
      items.push({ event })
    }
  }

  return { items, originalEvents }
}

export function useTimeline(options: UseTimelineOptions = {}): UseTimelineResult {
  const { authorPubkey, tags, q } = options

  // State
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [profiles, setProfiles] = useState<ProfileCache>({})
  const [reactions, setReactions] = useState<{ [eventId: string]: ReactionData }>({})
  const [replies, setReplies] = useState<{ [eventId: string]: ReplyData }>({})
  const [reposts, setReposts] = useState<{ [eventId: string]: RepostData }>({})
  const [views, setViews] = useState<{ [eventId: string]: ViewCountData }>({})
  const [wikidataMap, setWikidataMap] = useState<Record<string, string>>({})
  const [ogpMap, setOgpMap] = useState<Record<string, OgpData>>({})
  const [myPubkey, setMyPubkey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [likingId, setLikingId] = useState<string | null>(null)
  const [repostingId, setRepostingId] = useState<string | null>(null)
  const [pendingNewEvents, setPendingNewEvents] = useState<Event[]>([])
  const [latestEventTime, setLatestEventTime] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchedUntil, setSearchedUntil] = useState<number | null>(null)

  // Debounce refs for stella clicks
  const stellaDebounceTimers = useRef<{ [eventId: string]: ReturnType<typeof setTimeout> }>({})
  const pendingStella = useRef<{ [eventId: string]: { count: number; color: StellaColor } }>({})
  const reactionsRef = useRef(reactions)
  reactionsRef.current = reactions

  // Serialize arrays to avoid unnecessary re-renders (reference comparison)
  const tagsKey = tags ? JSON.stringify(tags) : ''
  const qKey = q ? JSON.stringify(q) : ''

  // フィルター設定を取得するヘルパー（毎回最新を読む）
  // 各フィルターは直交（独立）して動作する
  const getFilterOptions = useCallback(() => {
    const filters = getFilterSettings()
    const mutedPubkeys = getMutedPubkeys()
    // kinds: 各設定が独立して効果を持つ
    const kinds: number[] = []
    if (filters.showSNS) kinds.push(1) // KIND_NOTE
    if (filters.showSNS) kinds.push(6) // KIND_REPOST
    if (filters.showBlog) kinds.push(30023) // KIND_LONG_FORM
    if (!filters.hideNPC) kinds.push(42000) // KIND_SINOV_NPC（mypace設定とは独立）
    return {
      showAll: !filters.mypace,
      langFilter: filters.lang,
      hideAds: filters.hideAds,
      hideNSFW: filters.hideNSFW,
      hideNPC: filters.hideNPC,
      mutedPubkeys,
      ngWords: filters.ngWords,
      ngTags: filters.ngTags,
      kinds: kinds.length > 0 ? kinds : undefined,
    }
  }, [])

  // ポーリング機構
  const { loadNewEvents } = useTimelinePolling({
    options,
    latestEventTime,
    events,
    profiles,
    myPubkey,
    setPendingNewEvents,
    setProfiles,
    setTimelineItems,
    setEvents,
    setLatestEventTime,
    pendingNewEvents,
    setReactions,
    setReplies,
    setReposts,
    setViews,
    setWikidataMap,
    setOgpMap,
  })

  // タイムライン読み込み
  const loadTimeline = useCallback(async () => {
    setTimelineItems([])
    setEvents([])
    setPendingNewEvents([]) // フィルター変更時など、古いポーリング結果を破棄
    setSearchedUntil(Math.floor(Date.now() / 1000)) // 現在時刻にリセット（エラー時も過去分取得でリトライ可能に）
    setLoading(true)
    setError('')
    try {
      const pubkey = await getCurrentPubkey()
      setMyPubkey(pubkey)

      const filterOpts = getFilterOptions()
      let result: { events: Event[]; searchedUntil: number | null }
      if (authorPubkey) {
        result = await fetchUserEvents(authorPubkey, { limit: LIMITS.TIMELINE_FETCH_LIMIT, tags, q, ...filterOpts })
      } else {
        result = await fetchTimeline({ limit: LIMITS.TIMELINE_FETCH_LIMIT, queries: q, okTags: tags, ...filterOpts })
      }
      const notes = result.events

      // リポスト（kind:6）をTimelineItemに変換し、originalEventsを抽出
      const { items: initialItems, originalEvents } = eventsToTimelineItems(notes)
      initialItems.sort((a, b) => b.event.created_at - a.event.created_at)
      setTimelineItems(initialItems)
      setEvents(notes)
      setLoading(false)

      // searchedUntilはAPIから返された「フィルタ前の最古時刻」
      // 次回のuntilにはこれを使う（フィルタ後の最古ではなく）
      // nullの場合は現在時刻をフォールバック（初回0件でもリトライ可能に）
      setSearchedUntil(result.searchedUntil ?? Math.floor(Date.now() / 1000))

      // hasMoreは初回は常にtrue（まだ過去を探っていないため）
      // loadOlderEventsでsearchedUntilが変化しなくなったらfalseになる
      if (notes.length > 0) {
        const maxTime = Math.max(...notes.map((n) => n.created_at))
        setLatestEventTime(maxTime)
        setHasMore(true)
      } else if (result.searchedUntil !== null) {
        // フィルタ後0件でも、searchedUntilがあれば過去に遡る余地がある
        const now = Math.floor(Date.now() / 1000)
        setLatestEventTime(now)
        setHasMore(true)
      } else {
        // searchedUntilもnull = リレーから0件 = 本当の終端
        const now = Math.floor(Date.now() / 1000)
        setLatestEventTime(now)
        setHasMore(false)
      }

      // metadata + profiles + super-mention一括取得（リポスト元イベントも含める）
      const allEventsForEnrich = [...notes, ...originalEvents]
      await loadEnrichForEvents(
        allEventsForEnrich,
        pubkey,
        setReactions,
        setReplies,
        setReposts,
        setViews,
        setProfiles,
        setWikidataMap
      )

      // OGPデータ一括取得（非同期、fire-and-forget）- リポスト元も含める
      loadOgpForEvents(allEventsForEnrich, setOgpMap)

      // Record impressions (fire-and-forget)
      recordImpressionsForEvents(notes, pubkey)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load timeline'))
      setLoading(false)
    }
  }, [authorPubkey, tagsKey, qKey, getFilterOptions])

  // Stella送信
  const flushStella = async (targetEvent: Event) => {
    const eventId = targetEvent.id
    const pending = pendingStella.current[eventId]
    if (!pending || pending.count <= 0) return

    const stellaToSend = pending.count
    const stellaColor = pending.color

    delete pendingStella.current[eventId]
    delete stellaDebounceTimers.current[eventId]

    const latestReaction = reactionsRef.current[eventId]
    const previousReaction = latestReaction
    const oldReactionId = latestReaction?.myReactionId

    // カラーステラの場合は支払い処理
    const cost = getStellaCost(stellaColor, stellaToSend)
    if (cost > 0) {
      const authorProfile = profiles[targetEvent.pubkey]
      const lud16 = authorProfile?.lud16

      if (!lud16) {
        console.warn('Author has no lightning address, cannot send colored stella')
        // UIの更新を元に戻す
        setReactions((prev) => ({
          ...prev,
          [eventId]: previousReaction || {
            count: 0,
            myReaction: false,
            myStella: 0,
            myStellaColor: 'yellow' as const,
            myReactionId: null,
            reactors: [],
          },
        }))
        return
      }

      setLikingId(eventId)
      const payResult = await sendToLightningAddress(lud16, cost)
      if (!payResult.success) {
        console.error('Payment failed:', payResult.error)
        setLikingId(null)
        // UIの更新を元に戻す
        setReactions((prev) => ({
          ...prev,
          [eventId]: previousReaction || {
            count: 0,
            myReaction: false,
            myStella: 0,
            myStellaColor: 'yellow' as const,
            myReactionId: null,
            reactors: [],
          },
        }))
        return
      }
      // 支払い成功、続けてステラを送信
    } else {
      setLikingId(eventId)
    }

    try {
      const newTotalStella = Math.min(latestReaction?.myStella || stellaToSend, MAX_STELLA_PER_USER)
      const newReaction = await createReactionEvent(targetEvent, '+', newTotalStella, stellaColor)
      await publishEvent(newReaction)

      if (oldReactionId) {
        try {
          await publishEvent(await createDeleteEvent([oldReactionId]))
        } catch {}
      }

      setReactions((prev) => {
        const prevReactors = prev[eventId]?.reactors || []
        const myIndex = prevReactors.findIndex((r) => r.pubkey === myPubkey)
        const updatedReactors =
          myIndex >= 0
            ? prevReactors.map((r, i) =>
                i === myIndex
                  ? {
                      ...r,
                      stella: newTotalStella,
                      stellaColor,
                      reactionId: newReaction.id,
                      createdAt: newReaction.created_at,
                    }
                  : r
              )
            : [
                {
                  pubkey: myPubkey!,
                  stella: newTotalStella,
                  stellaColor,
                  reactionId: newReaction.id,
                  createdAt: newReaction.created_at,
                },
                ...prevReactors,
              ]

        return {
          ...prev,
          [eventId]: {
            count: prev[eventId]?.count || newTotalStella,
            myReaction: true,
            myStella: newTotalStella,
            myStellaColor: stellaColor,
            myReactionId: newReaction.id,
            reactors: updatedReactors,
          },
        }
      })
    } catch (error) {
      console.error('Failed to publish reaction:', error)
      setReactions((prev) => ({
        ...prev,
        [eventId]: previousReaction || {
          count: 0,
          myReaction: false,
          myStella: 0,
          myStellaColor: 'yellow' as const,
          myReactionId: null,
          reactors: [],
        },
      }))
    } finally {
      setLikingId(null)
    }
  }

  const handleLike = (event: Event, color: StellaColor = 'yellow') => {
    if (!myPubkey) return
    const eventId = event.id
    const currentReaction = reactions[eventId]
    const currentMyStella = currentReaction?.myStella || 0
    const pendingCount = pendingStella.current[eventId]?.count || 0
    if (currentMyStella + pendingCount >= MAX_STELLA_PER_USER) return

    pendingStella.current[eventId] = { count: pendingCount + 1, color }
    setReactions((prev) => ({
      ...prev,
      [eventId]: {
        count: (prev[eventId]?.count || 0) + 1,
        myReaction: true,
        myStella: (prev[eventId]?.myStella || 0) + 1,
        myStellaColor: color,
        myReactionId: prev[eventId]?.myReactionId || null,
        reactors: prev[eventId]?.reactors || [],
      },
    }))

    if (stellaDebounceTimers.current[eventId]) {
      clearTimeout(stellaDebounceTimers.current[eventId])
    }
    stellaDebounceTimers.current[eventId] = setTimeout(() => flushStella(event), 500)
  }

  const handleUnlike = async (event: Event) => {
    if (!myPubkey) return
    const eventId = event.id
    const currentReaction = reactions[eventId]
    if (!currentReaction?.myReactionId) return

    // カラーステラは取り消し不可（支払い済みのため）
    if (currentReaction.myStellaColor && currentReaction.myStellaColor !== 'yellow') {
      return
    }

    if (stellaDebounceTimers.current[eventId]) {
      clearTimeout(stellaDebounceTimers.current[eventId])
      delete stellaDebounceTimers.current[eventId]
    }
    delete pendingStella.current[eventId]

    const stellaToRemove = currentReaction.myStella || 0
    setLikingId(eventId)
    try {
      await publishEvent(await createDeleteEvent([currentReaction.myReactionId]))
      setReactions((prev) => ({
        ...prev,
        [eventId]: {
          count: Math.max(0, (prev[eventId]?.count || 0) - stellaToRemove),
          myReaction: false,
          myStella: 0,
          myStellaColor: 'yellow',
          myReactionId: null,
          reactors: (prev[eventId]?.reactors || []).filter((r) => r.pubkey !== myPubkey),
        },
      }))
    } catch (error) {
      console.error('Failed to delete reaction:', error)
    } finally {
      setLikingId(null)
    }
  }

  const handleRepost = async (event: Event) => {
    if (repostingId || !myPubkey || reposts[event.id]?.myRepost) return
    setRepostingId(event.id)
    try {
      await publishEvent(await createRepostEvent(event))
      setReposts((prev) => ({ ...prev, [event.id]: { count: (prev[event.id]?.count || 0) + 1, myRepost: true } }))
    } finally {
      setRepostingId(null)
    }
  }

  const handleDelete = async (event: Event) => {
    try {
      await publishEvent(await createDeleteEvent([event.id]))
      setTimeout(loadTimeline, TIMEOUTS.POST_ACTION_RELOAD)
    } catch {}
  }

  const getDisplayName = useCallback((pubkey: string): string => getDisplayNameFromCache(pubkey, profiles), [profiles])
  const getAvatarUrl = useCallback(
    (pubkey: string): string | null => getAvatarUrlFromCache(pubkey, profiles),
    [profiles]
  )

  // 古い投稿を読み込む（無限スクロール用）
  // hasMore=falseでもリトライ可能（ネットワーク障害等からの復旧用）
  // 古い投稿を下に追加 → 200件を超えたら上（新しい方）から削除
  const loadOlderEvents = useCallback(async () => {
    if (loadingMore || searchedUntil === null) return
    // 先にローディング状態にする（ボタンを消す/入れ替わりを自然に見せる）
    setLoadingMore(true)
    try {
      // searchedUntilは「フィルタ前の最古時刻」なので、これを基準に過去を探す
      const untilTime = searchedUntil - 1
      const filterOpts = getFilterOptions()
      let result: { events: Event[]; searchedUntil: number | null }
      if (authorPubkey) {
        result = await fetchUserEvents(authorPubkey, {
          limit: LIMITS.TIMELINE_FETCH_LIMIT,
          until: untilTime,
          tags,
          q,
          ...filterOpts,
        })
      } else {
        result = await fetchTimeline({
          limit: LIMITS.TIMELINE_FETCH_LIMIT,
          until: untilTime,
          queries: q,
          okTags: tags,
          ...filterOpts,
        })
      }

      const olderNotes = result.events
      const newSearchedUntil = result.searchedUntil

      // hasMoreは「searchedUntilが変化したか」で判定
      // リレーから0件（newSearchedUntil=null）でもsearchedUntilは上書きしない（リトライ可能）
      if (newSearchedUntil === null) {
        setHasMore(false)
        // searchedUntilは上書きしない（前回の値を維持してリトライ可能に）
        return
      }

      // searchedUntilが変化したか
      const searchedUntilChanged = newSearchedUntil < searchedUntil
      setSearchedUntil(newSearchedUntil)
      setHasMore(searchedUntilChanged)

      // フィルタ後の投稿を追加
      const existingIds = new Set(events.map((e) => e.id))
      const newOlderNotes = olderNotes.filter((e) => !existingIds.has(e.id))

      if (newOlderNotes.length > 0) {
        // リポスト（kind:6）をTimelineItemに変換
        const { items: newItems, originalEvents } = eventsToTimelineItems(newOlderNotes)
        setTimelineItems((prev) => {
          const merged = [...prev, ...newItems]
          merged.sort((a, b) => b.event.created_at - a.event.created_at)
          // Trim from top (newer items) if exceeding limit - keep oldest items
          if (merged.length > LIMITS.MAX_TIMELINE_ITEMS) {
            return merged.slice(-LIMITS.MAX_TIMELINE_ITEMS)
          }
          return merged
        })
        setEvents((prev) => {
          const merged = [...prev, ...newOlderNotes]
          merged.sort((a, b) => b.created_at - a.created_at)
          // Trim from top (newer items) if exceeding limit - keep oldest items
          if (merged.length > LIMITS.MAX_TIMELINE_ITEMS) {
            return merged.slice(-LIMITS.MAX_TIMELINE_ITEMS)
          }
          return merged
        })

        // metadata + profiles + super-mention一括取得（リポスト元イベントも含める）
        if (myPubkey) {
          const allEventsForEnrich = [...newOlderNotes, ...originalEvents]
          await loadEnrichForEvents(
            allEventsForEnrich,
            myPubkey,
            setReactions,
            setReplies,
            setReposts,
            setViews,
            setProfiles,
            setWikidataMap
          )
          // OGPデータ一括取得（非同期）- リポスト元も含める
          loadOgpForEvents(allEventsForEnrich, setOgpMap)
          // Record impressions for older events (fire-and-forget)
          recordImpressionsForEvents(newOlderNotes, myPubkey)
        }
      }
    } catch (err) {
      console.error('Failed to load older events:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, searchedUntil, events, authorPubkey, tagsKey, qKey, myPubkey, getFilterOptions])

  const loadTimelineRef = useRef(loadTimeline)
  loadTimelineRef.current = loadTimeline

  useEffect(() => {
    loadTimelineRef.current()
    const handleNewPost = () => setTimeout(() => loadTimelineRef.current(), TIMEOUTS.NEW_POST_RELOAD)
    const handleFilterApplied = () => loadTimelineRef.current()
    window.addEventListener(CUSTOM_EVENTS.NEW_POST, handleNewPost)
    window.addEventListener(CUSTOM_EVENTS.FILTER_APPLIED, handleFilterApplied)
    return () => {
      window.removeEventListener(CUSTOM_EVENTS.NEW_POST, handleNewPost)
      window.removeEventListener(CUSTOM_EVENTS.FILTER_APPLIED, handleFilterApplied)
    }
  }, [authorPubkey, tagsKey, qKey])

  return {
    items: timelineItems,
    events,
    profiles,
    reactions,
    replies,
    reposts,
    views,
    wikidataMap,
    ogpMap,
    myPubkey,
    loading,
    error,
    likingId,
    repostingId,
    newEventCount: pendingNewEvents.length,
    hasMore,
    loadingMore,
    reload: loadTimeline,
    loadNewEvents,
    loadOlderEvents,
    handleLike,
    handleUnlike,
    handleRepost,
    handleDelete,
    getDisplayName,
    getAvatarUrl,
  }
}
