import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchTimeline, fetchUserEvents, publishEvent, parseRepostEvent } from '../../lib/nostr/relay'
import { KIND_REPOST } from '../../lib/nostr/constants'
import {
  getCurrentPubkey,
  createDeleteEvent,
  createReactionEvent,
  createRepostEvent,
  MAX_STELLA_PER_USER,
  EMPTY_STELLA_COUNTS,
  getTotalStellaCount,
  type StellaColor,
  type StellaCountsByColor,
} from '../../lib/nostr/events'
import { getDisplayNameFromCache, getAvatarUrlFromCache, getErrorMessage, getMutedPubkeys } from '../../lib/utils'
import { getFilterSettings } from '../../lib/storage'
import { TIMEOUTS, CUSTOM_EVENTS, LIMITS } from '../../lib/constants'
import { sendToLightningAddress } from '../../lib/lightning'
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
  // Pending stella per color
  const pendingStella = useRef<{ [eventId: string]: StellaCountsByColor }>({})
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

  // 空のReactionData
  const emptyReaction: ReactionData = {
    myReaction: false,
    myStella: { ...EMPTY_STELLA_COUNTS },
    myReactionId: null,
    reactors: [],
  }

  // Stella送信（色ごとに処理）
  const flushStella = async (targetEvent: Event) => {
    const eventId = targetEvent.id
    const pending = pendingStella.current[eventId]
    if (!pending) return

    const pendingTotal = getTotalStellaCount(pending)
    if (pendingTotal <= 0) return

    // 送信するステラ数（pending分）をコピーして保存
    const stellaToSend = { ...pending }
    delete pendingStella.current[eventId]
    delete stellaDebounceTimers.current[eventId]

    const latestReaction = reactionsRef.current[eventId]
    const previousReaction = latestReaction
    const oldReactionId = latestReaction?.myReactionId

    // カラーステラの支払い処理（色ごとに計算）
    const colorCost =
      stellaToSend.green * 1 + stellaToSend.red * 10 + stellaToSend.blue * 100 + stellaToSend.purple * 1000
    if (colorCost > 0) {
      const authorProfile = profiles[targetEvent.pubkey]
      const lud16 = authorProfile?.lud16

      if (!lud16) {
        console.warn('Author has no lightning address, cannot send colored stella')
        setReactions((prev) => ({
          ...prev,
          [eventId]: previousReaction || emptyReaction,
        }))
        return
      }

      setLikingId(eventId)
      const payResult = await sendToLightningAddress(lud16, colorCost)
      if (!payResult.success) {
        console.error('Payment failed:', payResult.error)
        setLikingId(null)
        setReactions((prev) => ({
          ...prev,
          [eventId]: previousReaction || emptyReaction,
        }))
        return
      }
    } else {
      setLikingId(eventId)
    }

    try {
      // 新しい合計ステラ数（既存 + pending）
      const currentMyStella = latestReaction?.myStella || { ...EMPTY_STELLA_COUNTS }
      const newMyStella: StellaCountsByColor = {
        yellow: Math.min(currentMyStella.yellow + stellaToSend.yellow, MAX_STELLA_PER_USER),
        green: Math.min(currentMyStella.green + stellaToSend.green, MAX_STELLA_PER_USER),
        red: Math.min(currentMyStella.red + stellaToSend.red, MAX_STELLA_PER_USER),
        blue: Math.min(currentMyStella.blue + stellaToSend.blue, MAX_STELLA_PER_USER),
        purple: Math.min(currentMyStella.purple + stellaToSend.purple, MAX_STELLA_PER_USER),
      }

      const newReaction = await createReactionEvent(targetEvent, '+', newMyStella)
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
                      stella: newMyStella,
                      reactionId: newReaction.id,
                      createdAt: newReaction.created_at,
                    }
                  : r
              )
            : [
                {
                  pubkey: myPubkey!,
                  stella: newMyStella,
                  reactionId: newReaction.id,
                  createdAt: newReaction.created_at,
                },
                ...prevReactors,
              ]

        return {
          ...prev,
          [eventId]: {
            myReaction: true,
            myStella: newMyStella,
            myReactionId: newReaction.id,
            reactors: updatedReactors,
          },
        }
      })
    } catch (error) {
      console.error('Failed to publish reaction:', error)
      setReactions((prev) => ({
        ...prev,
        [eventId]: previousReaction || emptyReaction,
      }))
    } finally {
      setLikingId(null)
    }
  }

  // ステラを追加（色を指定）
  const handleAddStella = (event: Event, color: StellaColor) => {
    if (!myPubkey) return
    const eventId = event.id
    const currentReaction = reactions[eventId]
    const currentMyStella = currentReaction?.myStella || { ...EMPTY_STELLA_COUNTS }
    const currentTotal = getTotalStellaCount(currentMyStella)
    const pendingCounts = pendingStella.current[eventId] || { ...EMPTY_STELLA_COUNTS }
    const pendingTotal = getTotalStellaCount(pendingCounts)

    if (currentTotal + pendingTotal >= MAX_STELLA_PER_USER) return

    // pending に追加
    pendingStella.current[eventId] = {
      ...pendingCounts,
      [color]: pendingCounts[color] + 1,
    }

    // 楽観的更新
    setReactions((prev) => {
      const prevData = prev[eventId] || emptyReaction
      const newMyStella = {
        ...prevData.myStella,
        [color]: prevData.myStella[color] + 1,
      }
      return {
        ...prev,
        [eventId]: {
          myReaction: true,
          myStella: newMyStella,
          myReactionId: prevData.myReactionId,
          reactors: prevData.reactors,
        },
      }
    })

    if (stellaDebounceTimers.current[eventId]) {
      clearTimeout(stellaDebounceTimers.current[eventId])
    }
    stellaDebounceTimers.current[eventId] = setTimeout(() => flushStella(event), 500)
  }

  // ステラを取り消し（イエローのみ可能）
  const handleUnlike = async (event: Event) => {
    if (!myPubkey) return
    const eventId = event.id
    const currentReaction = reactions[eventId]
    if (!currentReaction?.myReactionId) return

    const myStella = currentReaction.myStella
    // イエローがなければ取り消す対象がない
    if (myStella.yellow <= 0) return

    if (stellaDebounceTimers.current[eventId]) {
      clearTimeout(stellaDebounceTimers.current[eventId])
      delete stellaDebounceTimers.current[eventId]
    }
    delete pendingStella.current[eventId]

    // イエローを0にして、カラーステラは残す
    const newMyStella: StellaCountsByColor = {
      yellow: 0,
      green: myStella.green,
      red: myStella.red,
      blue: myStella.blue,
      purple: myStella.purple,
    }
    const remainingTotal = getTotalStellaCount(newMyStella)

    setLikingId(eventId)
    try {
      if (remainingTotal > 0) {
        // カラーステラが残る場合は新しいリアクションを発行
        const newReaction = await createReactionEvent(event, '+', newMyStella)
        await publishEvent(newReaction)
        // 古いリアクションを削除
        try {
          await publishEvent(await createDeleteEvent([currentReaction.myReactionId]))
        } catch {
          // 削除失敗は無視
        }
        setReactions((prev) => {
          const prevReactors = prev[eventId]?.reactors || []
          const updatedReactors = prevReactors.map((r) =>
            r.pubkey === myPubkey
              ? { ...r, stella: newMyStella, reactionId: newReaction.id, createdAt: newReaction.created_at }
              : r
          )
          return {
            ...prev,
            [eventId]: {
              myReaction: true,
              myStella: newMyStella,
              myReactionId: newReaction.id,
              reactors: updatedReactors,
            },
          }
        })
      } else {
        // 全てのステラを削除
        await publishEvent(await createDeleteEvent([currentReaction.myReactionId]))
        setReactions((prev) => ({
          ...prev,
          [eventId]: {
            myReaction: false,
            myStella: { ...EMPTY_STELLA_COUNTS },
            myReactionId: null,
            reactors: (prev[eventId]?.reactors || []).filter((r) => r.pubkey !== myPubkey),
          },
        }))
      }
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
    handleAddStella,
    handleUnlike,
    handleRepost,
    handleDelete,
    getDisplayName,
    getAvatarUrl,
  }
}
