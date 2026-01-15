import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchEvents, fetchUserPosts, publishEvent } from '../../lib/nostr/relay'
import {
  getCurrentPubkey,
  createDeleteEvent,
  createReactionEvent,
  createRepostEvent,
  MAX_STELLA_PER_USER,
} from '../../lib/nostr/events'
import { getDisplayNameFromCache, getAvatarUrlFromCache, getErrorMessage } from '../../lib/utils'
import { TIMEOUTS, CUSTOM_EVENTS, LIMITS } from '../../lib/constants'
import type { Event, ProfileCache, ReactionData, ReplyData, RepostData, ViewCountData, TimelineItem } from '../../types'
import type { GapInfo, UseTimelineOptions, UseTimelineResult } from './types'
import {
  loadProfiles,
  loadReactionsForEvents,
  loadRepliesForEvents,
  loadRepostsForEvents,
  loadViewsForEvents,
  recordImpressionsForEvents,
  mergeProfiles,
} from './useTimelineData'
import { useTimelinePolling } from './useTimelinePolling'
import { useGapDetection } from './useGapDetection'

export type { GapInfo, UseTimelineOptions, UseTimelineResult }

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
  const [myPubkey, setMyPubkey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [likingId, setLikingId] = useState<string | null>(null)
  const [repostingId, setRepostingId] = useState<string | null>(null)
  const [pendingNewEvents, setPendingNewEvents] = useState<Event[]>([])
  const [latestEventTime, setLatestEventTime] = useState(0)
  const [_oldestEventTime, setOldestEventTime] = useState(0)
  const [gaps, setGaps] = useState<GapInfo[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingGap, setLoadingGap] = useState<string | null>(null)
  const [searchedUntil, setSearchedUntil] = useState<number | null>(null)

  // Debounce refs for stella clicks
  const stellaDebounceTimers = useRef<{ [eventId: string]: ReturnType<typeof setTimeout> }>({})
  const pendingStella = useRef<{ [eventId: string]: number }>({})
  const reactionsRef = useRef(reactions)
  reactionsRef.current = reactions

  // Serialize arrays to avoid unnecessary re-renders (reference comparison)
  const tagsKey = tags ? JSON.stringify(tags) : ''
  const qKey = q ? JSON.stringify(q) : ''

  // ポーリング機構
  const { loadNewEvents } = useTimelinePolling({
    options,
    latestEventTime,
    events,
    setPendingNewEvents,
    setGaps,
    setProfiles,
    setTimelineItems,
    setEvents,
    setLatestEventTime,
    pendingNewEvents,
  })

  // ギャップ検出
  const { fillGap } = useGapDetection({
    options,
    gaps,
    loadingGap,
    events,
    setGaps,
    setLoadingGap,
    setTimelineItems,
    setEvents,
    setProfiles,
  })

  // タイムライン読み込み
  const loadTimeline = useCallback(async () => {
    setTimelineItems([])
    setEvents([])
    setLoading(true)
    setError('')
    try {
      const pubkey = await getCurrentPubkey()
      setMyPubkey(pubkey)

      let result: { events: Event[]; searchedUntil: number | null }
      if (authorPubkey) {
        result = await fetchUserPosts(authorPubkey, { limit: LIMITS.TIMELINE_FETCH_LIMIT, tags, q })
      } else {
        result = await fetchEvents({ limit: LIMITS.TIMELINE_FETCH_LIMIT, q, tags })
      }
      const notes = result.events

      const initialItems: TimelineItem[] = notes.map((note) => ({ event: note }))
      initialItems.sort((a, b) => b.event.created_at - a.event.created_at)
      setTimelineItems(initialItems)
      setEvents(notes)
      setLoading(false)

      // searchedUntilはAPIから返された「フィルタ前の最古時刻」
      // 次回のuntilにはこれを使う（フィルタ後の最古ではなく）
      if (result.searchedUntil !== null) {
        setSearchedUntil(result.searchedUntil)
      }

      // hasMoreは初回は常にtrue（まだ過去を探っていないため）
      // loadOlderEventsでsearchedUntilが変化しなくなったらfalseになる
      if (notes.length > 0) {
        const maxTime = Math.max(...notes.map((n) => n.created_at))
        const minTime = Math.min(...notes.map((n) => n.created_at))
        setLatestEventTime(maxTime)
        setOldestEventTime(minTime)
        setHasMore(true)
      } else if (result.searchedUntil !== null) {
        // フィルタ後0件でも、searchedUntilがあれば過去に遡る余地がある
        const now = Math.floor(Date.now() / 1000)
        setLatestEventTime(now)
        setOldestEventTime(now)
        setHasMore(true)
      } else {
        // searchedUntilもnull = リレーから0件 = 本当の終端
        const now = Math.floor(Date.now() / 1000)
        setLatestEventTime(now)
        setOldestEventTime(now)
        setHasMore(false)
      }
      setGaps([])

      const loadedProfiles = await loadProfiles(notes, profiles, setProfiles)
      await Promise.all([
        loadReactionsForEvents(notes, pubkey, loadedProfiles, setReactions, setProfiles),
        loadRepliesForEvents(notes, loadedProfiles, setReplies, setProfiles),
        loadRepostsForEvents(notes, pubkey, setReposts),
        loadViewsForEvents(notes, setViews),
      ])

      // Record impressions (fire-and-forget)
      recordImpressionsForEvents(notes, pubkey)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load timeline'))
      setLoading(false)
    }
  }, [authorPubkey, tagsKey, qKey, profiles])

  // Stella送信
  const flushStella = async (targetEvent: Event) => {
    const eventId = targetEvent.id
    const stellaToSend = pendingStella.current[eventId] || 0
    if (stellaToSend <= 0) return

    delete pendingStella.current[eventId]
    delete stellaDebounceTimers.current[eventId]

    const latestReaction = reactionsRef.current[eventId]
    const previousReaction = latestReaction
    const oldReactionId = latestReaction?.myReactionId

    setLikingId(eventId)
    try {
      const newTotalStella = Math.min(latestReaction?.myStella || stellaToSend, MAX_STELLA_PER_USER)
      const newReaction = await createReactionEvent(targetEvent, '+', newTotalStella)
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
                  ? { ...r, stella: newTotalStella, reactionId: newReaction.id, createdAt: newReaction.created_at }
                  : r
              )
            : [
                {
                  pubkey: myPubkey!,
                  stella: newTotalStella,
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
            myReactionId: newReaction.id,
            reactors: updatedReactors,
          },
        }
      })
    } catch (error) {
      console.error('Failed to publish reaction:', error)
      setReactions((prev) => ({
        ...prev,
        [eventId]: previousReaction || { count: 0, myReaction: false, myStella: 0, myReactionId: null, reactors: [] },
      }))
    } finally {
      setLikingId(null)
    }
  }

  const handleLike = (event: Event) => {
    if (!myPubkey) return
    const eventId = event.id
    const currentReaction = reactions[eventId]
    const currentMyStella = currentReaction?.myStella || 0
    const pendingCount = pendingStella.current[eventId] || 0
    if (currentMyStella + pendingCount >= MAX_STELLA_PER_USER) return

    pendingStella.current[eventId] = pendingCount + 1
    setReactions((prev) => ({
      ...prev,
      [eventId]: {
        count: (prev[eventId]?.count || 0) + 1,
        myReaction: true,
        myStella: (prev[eventId]?.myStella || 0) + 1,
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
  const loadOlderEvents = useCallback(async () => {
    if (loadingMore || searchedUntil === null) return
    setLoadingMore(true)
    try {
      // searchedUntilは「フィルタ前の最古時刻」なので、これを基準に過去を探す
      // フィルタ後の最古（oldestEventTime）ではなく、探索済み範囲の最古を使う
      const untilTime = searchedUntil - 1
      let result: { events: Event[]; searchedUntil: number | null }
      if (authorPubkey) {
        result = await fetchUserPosts(authorPubkey, {
          limit: LIMITS.TIMELINE_FETCH_LIMIT,
          until: untilTime,
          tags,
          q,
        })
      } else {
        result = await fetchEvents({ limit: LIMITS.TIMELINE_FETCH_LIMIT, until: untilTime, q, tags })
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
        const newItems: TimelineItem[] = newOlderNotes.map((event) => ({ event }))
        setTimelineItems((prev) => {
          const merged = [...prev, ...newItems]
          merged.sort((a, b) => b.event.created_at - a.event.created_at)
          return merged
        })
        setEvents((prev) => {
          const merged = [...prev, ...newOlderNotes]
          merged.sort((a, b) => b.created_at - a.created_at)
          return merged
        })

        const minTime = Math.min(...newOlderNotes.map((e) => e.created_at))
        setOldestEventTime(minTime)
        await mergeProfiles([...new Set(newOlderNotes.map((e) => e.pubkey))], setProfiles)
      }
    } catch (err) {
      console.error('Failed to load older events:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, searchedUntil, events, authorPubkey, tagsKey, qKey])

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
    myPubkey,
    loading,
    error,
    likingId,
    repostingId,
    newEventCount: pendingNewEvents.length,
    gaps,
    hasMore,
    loadingMore,
    loadingGap,
    reload: loadTimeline,
    loadNewEvents,
    loadOlderEvents,
    fillGap,
    handleLike,
    handleUnlike,
    handleRepost,
    handleDelete,
    getDisplayName,
    getAvatarUrl,
  }
}
