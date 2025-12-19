import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchEvents,
  fetchProfiles,
  fetchReactions,
  fetchReplies,
  fetchReposts,
  fetchUserPosts,
  publishEvent,
} from '../lib/nostr/relay'
import {
  getCurrentPubkey,
  createDeleteEvent,
  createReactionEvent,
  createRepostEvent,
  MAX_STELLA_PER_USER,
} from '../lib/nostr/events'
import { getDisplayNameFromCache, getAvatarUrlFromCache, getErrorMessage } from '../lib/utils'
import { TIMEOUTS, CUSTOM_EVENTS, LIMITS } from '../lib/constants'
import type { Event, ProfileCache, ReactionData, ReplyData, RepostData, TimelineItem } from '../types'

const POLLING_INTERVAL = 60 * 1000 // 1分

// ギャップ情報を表す型
interface GapInfo {
  id: string // ユニークID
  afterEventId: string // このイベントの後にギャップがある
  since: number // ギャップの開始時刻（古い側）
  until: number // ギャップの終了時刻（新しい側）
}

interface UseTimelineOptions {
  authorPubkey?: string // 特定ユーザーの投稿のみ取得
  mypaceOnly?: boolean // mypaceタグでフィルタリング（デフォルト: true）
  showSNS?: boolean // Show kind 1 (short notes) (デフォルト: true)
  showBlog?: boolean // Show kind 30023 (long-form articles) (デフォルト: true)
  hideAds?: boolean // Hide ad/spam content (デフォルト: true)
  hideNSFW?: boolean // Hide NSFW content (デフォルト: true)
  lang?: string // Language filter (デフォルト: '')
}

interface UseTimelineResult {
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

export function useTimeline(options: UseTimelineOptions = {}): UseTimelineResult {
  const {
    authorPubkey,
    mypaceOnly = true,
    showSNS = true,
    showBlog = true,
    hideAds = true,
    hideNSFW = true,
    lang = '',
  } = options
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [profiles, setProfiles] = useState<ProfileCache>({})
  const [reactions, setReactions] = useState<{ [eventId: string]: ReactionData }>({})
  const [replies, setReplies] = useState<{ [eventId: string]: ReplyData }>({})
  const [reposts, setReposts] = useState<{ [eventId: string]: RepostData }>({})
  const [myPubkey, setMyPubkey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [likingId, setLikingId] = useState<string | null>(null)
  const [repostingId, setRepostingId] = useState<string | null>(null)
  const [pendingNewEvents, setPendingNewEvents] = useState<Event[]>([])
  const [latestEventTime, setLatestEventTime] = useState(0)
  const [oldestEventTime, setOldestEventTime] = useState(0)
  const [gaps, setGaps] = useState<GapInfo[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingGap, setLoadingGap] = useState<string | null>(null)

  // Debounce refs for stella clicks
  const stellaDebounceTimers = useRef<{ [eventId: string]: ReturnType<typeof setTimeout> }>({})
  const pendingStella = useRef<{ [eventId: string]: number }>({})
  // Track latest reactions to avoid stale closure in setTimeout
  const reactionsRef = useRef(reactions)
  reactionsRef.current = reactions

  const loadProfiles = async (events: Event[], currentProfiles: ProfileCache) => {
    const pubkeys = [...new Set(events.map((e) => e.pubkey))]
    const missingPubkeys = pubkeys.filter((pk) => currentProfiles[pk] === undefined)
    if (missingPubkeys.length === 0) return currentProfiles

    try {
      const fetchedProfiles = await fetchProfiles(missingPubkeys)
      const newProfiles: ProfileCache = { ...currentProfiles }
      for (const pk of missingPubkeys) {
        newProfiles[pk] = fetchedProfiles[pk] || null
      }
      setProfiles(newProfiles)
      return newProfiles
    } catch {
      return currentProfiles
    }
  }

  const loadReactionsForEvents = async (events: Event[], myPubkey: string, currentProfiles: ProfileCache) => {
    const reactionMap: { [eventId: string]: ReactionData } = {}
    const allReactorPubkeys: string[] = []

    await Promise.all(
      events.map(async (event) => {
        try {
          const result = await fetchReactions(event.id, myPubkey)
          reactionMap[event.id] = result
          result.reactors.forEach((r) => allReactorPubkeys.push(r.pubkey))
        } catch {
          reactionMap[event.id] = { count: 0, myReaction: false, myStella: 0, myReactionId: null, reactors: [] }
        }
      })
    )
    setReactions(reactionMap)

    // Load profiles for reactors
    const missingPubkeys = [...new Set(allReactorPubkeys)].filter((pk) => currentProfiles[pk] === undefined)
    if (missingPubkeys.length > 0) {
      try {
        const fetchedProfiles = await fetchProfiles(missingPubkeys)
        setProfiles((prev) => {
          const newProfiles = { ...prev }
          for (const pk of missingPubkeys) {
            newProfiles[pk] = fetchedProfiles[pk] || null
          }
          return newProfiles
        })
      } catch {}
    }
  }

  const loadRepliesForEvents = async (events: Event[], currentProfiles: ProfileCache) => {
    const replyMap: { [eventId: string]: ReplyData } = {}
    const allReplyPubkeys: string[] = []

    await Promise.all(
      events.map(async (event) => {
        try {
          const result = await fetchReplies(event.id)
          replyMap[event.id] = result
          result.replies.forEach((r) => allReplyPubkeys.push(r.pubkey))
        } catch {
          replyMap[event.id] = { count: 0, replies: [] }
        }
      })
    )
    setReplies(replyMap)

    // Load profiles for reply authors
    const missingPubkeys = [...new Set(allReplyPubkeys)].filter((pk) => currentProfiles[pk] === undefined)
    if (missingPubkeys.length > 0) {
      try {
        const fetchedProfiles = await fetchProfiles(missingPubkeys)
        setProfiles((prev) => {
          const newProfiles = { ...prev }
          for (const pk of missingPubkeys) {
            newProfiles[pk] = fetchedProfiles[pk] || null
          }
          return newProfiles
        })
      } catch {}
    }
  }

  const loadRepostsForEvents = async (events: Event[], myPubkey: string) => {
    const repostMap: { [eventId: string]: RepostData } = {}
    await Promise.all(
      events.map(async (event) => {
        try {
          const result = await fetchReposts(event.id, myPubkey)
          repostMap[event.id] = result
        } catch {
          repostMap[event.id] = { count: 0, myRepost: false }
        }
      })
    )
    setReposts(repostMap)
  }

  const loadTimeline = useCallback(async () => {
    // Clear existing data and show loading state
    setTimelineItems([])
    setEvents([])
    setLoading(true)
    setError('')
    try {
      const pubkey = await getCurrentPubkey()
      setMyPubkey(pubkey)

      let notes: Event[]
      if (authorPubkey) {
        // 特定ユーザーの投稿を取得
        notes = await fetchUserPosts(authorPubkey, LIMITS.TIMELINE_FETCH_LIMIT)
      } else {
        // mypace投稿を取得（タグ/キーワードはクライアント側でフィルタリング）
        notes = await fetchEvents(
          LIMITS.TIMELINE_FETCH_LIMIT,
          0,
          mypaceOnly,
          lang,
          0,
          showSNS,
          showBlog,
          hideAds,
          hideNSFW
        )
      }

      const initialItems: TimelineItem[] = notes.map((note) => ({ event: note }))
      initialItems.sort((a, b) => b.event.created_at - a.event.created_at)
      setTimelineItems(initialItems)
      setEvents(notes)
      setLoading(false)

      // リアルタイム購読用に最新/最古イベント時刻を記録
      if (notes.length > 0) {
        const maxTime = Math.max(...notes.map((n) => n.created_at))
        const minTime = Math.min(...notes.map((n) => n.created_at))
        setLatestEventTime(maxTime)
        setOldestEventTime(minTime)
        setHasMore(notes.length >= LIMITS.TIMELINE_FETCH_LIMIT)
      } else {
        setLatestEventTime(Math.floor(Date.now() / 1000))
        setOldestEventTime(0)
        setHasMore(false)
      }
      setGaps([])

      const loadedProfiles = await loadProfiles(notes, profiles)
      await Promise.all([
        loadReactionsForEvents(notes, pubkey, loadedProfiles),
        loadRepliesForEvents(notes, loadedProfiles),
        loadRepostsForEvents(notes, pubkey),
      ])
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load timeline'))
      setLoading(false)
    }
  }, [authorPubkey, mypaceOnly, showSNS, showBlog])

  // Send accumulated stella to the network
  const flushStella = async (targetEvent: Event) => {
    const eventId = targetEvent.id
    const stellaToSend = pendingStella.current[eventId] || 0
    if (stellaToSend <= 0) return

    // Clear pending stella
    delete pendingStella.current[eventId]
    delete stellaDebounceTimers.current[eventId]

    // Use reactionsRef to get latest state (avoid stale closure)
    const latestReaction = reactionsRef.current[eventId]
    const previousReaction = latestReaction
    const oldReactionId = latestReaction?.myReactionId

    setLikingId(eventId)
    try {
      // Use the optimistically updated myStella directly (already includes pending stella)
      const newTotalStella = Math.min(latestReaction?.myStella || stellaToSend, MAX_STELLA_PER_USER)

      // Create new reaction with accumulated stella FIRST (before deleting old one)
      const newReaction = await createReactionEvent(targetEvent, '+', newTotalStella)
      await publishEvent(newReaction)

      // Delete old reaction AFTER new one is successfully published
      if (oldReactionId) {
        try {
          await publishEvent(await createDeleteEvent([oldReactionId]))
        } catch {
          // Ignore delete errors - old reaction will eventually be overridden
        }
      }

      // Update local state with new reaction info
      // Note: count is already correct from optimistic update, just update reactionId and reactors
      setReactions((prev) => {
        const prevReactors = prev[eventId]?.reactors || []
        // Update or add my entry in reactors
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
            count: prev[eventId]?.count || newTotalStella, // Keep optimistically updated count
            myReaction: true,
            myStella: newTotalStella,
            myReactionId: newReaction.id,
            reactors: updatedReactors,
          },
        }
      })
    } catch (error) {
      console.error('Failed to publish reaction:', error)
      // Rollback UI state to previous state
      setReactions((prev) => ({
        ...prev,
        [eventId]: previousReaction || {
          count: 0,
          myReaction: false,
          myStella: 0,
          myReactionId: null,
          reactors: [],
        },
      }))
    } finally {
      setLikingId(null)
    }
  }

  // Debounced stella click handler
  const handleLike = (event: Event) => {
    if (!myPubkey) return

    const eventId = event.id
    const currentReaction = reactions[eventId]
    const currentMyStella = currentReaction?.myStella || 0
    const pendingCount = pendingStella.current[eventId] || 0

    // Check if we've reached the limit
    if (currentMyStella + pendingCount >= MAX_STELLA_PER_USER) return

    // Increment pending stella
    pendingStella.current[eventId] = pendingCount + 1

    // Update local state immediately for visual feedback
    // Simply increment by 1 (don't double-count pendingCount)
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

    // Clear existing timer and set new one (debounce 500ms)
    if (stellaDebounceTimers.current[eventId]) {
      clearTimeout(stellaDebounceTimers.current[eventId])
    }
    stellaDebounceTimers.current[eventId] = setTimeout(() => {
      flushStella(event)
    }, 500)
  }

  // Cancel/remove stella (long press feature)
  const handleUnlike = async (event: Event) => {
    if (!myPubkey) return

    const eventId = event.id
    const currentReaction = reactions[eventId]
    if (!currentReaction?.myReactionId) return

    // Cancel any pending debounce
    if (stellaDebounceTimers.current[eventId]) {
      clearTimeout(stellaDebounceTimers.current[eventId])
      delete stellaDebounceTimers.current[eventId]
    }
    delete pendingStella.current[eventId]

    // Save current stella for updating count
    const stellaToRemove = currentReaction.myStella || 0

    setLikingId(eventId)
    try {
      // Delete the reaction
      await publishEvent(await createDeleteEvent([currentReaction.myReactionId]))

      // Update local state
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
      setReposts((prev) => ({
        ...prev,
        [event.id]: { count: (prev[event.id]?.count || 0) + 1, myRepost: true },
      }))
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

  // 新着イベントをタイムラインに反映
  const loadNewEvents = useCallback(async () => {
    if (pendingNewEvents.length === 0) return

    const newItems: TimelineItem[] = pendingNewEvents.map((event) => ({ event }))
    setTimelineItems((prev) => {
      const existingIds = new Set(prev.map((item) => item.event.id))
      const uniqueNewItems = newItems.filter((item) => !existingIds.has(item.event.id))
      const merged = [...uniqueNewItems, ...prev]
      merged.sort((a, b) => b.event.created_at - a.event.created_at)
      return merged
    })
    setEvents((prev) => {
      const existingIds = new Set(prev.map((e) => e.id))
      const uniqueNew = pendingNewEvents.filter((e) => !existingIds.has(e.id))
      return [...uniqueNew, ...prev].sort((a, b) => b.created_at - a.created_at)
    })

    // 新着イベントの最新時刻を記録
    if (pendingNewEvents.length > 0) {
      const maxTime = Math.max(...pendingNewEvents.map((e) => e.created_at))
      setLatestEventTime((prev) => Math.max(prev, maxTime))
    }

    // プロフィール取得 - setProfilesのコールバック形式で最新状態を取得
    const pubkeys = [...new Set(pendingNewEvents.map((e) => e.pubkey))]
    try {
      const fetchedProfiles = await fetchProfiles(pubkeys)
      setProfiles((prev) => {
        const newProfiles = { ...prev }
        for (const pk of pubkeys) {
          if (newProfiles[pk] === undefined) {
            newProfiles[pk] = fetchedProfiles[pk] || null
          }
        }
        return newProfiles
      })
    } catch {}

    setPendingNewEvents([])
  }, [pendingNewEvents])

  // 新着チェック（ポーリング）- ギャップ検出付き
  const checkNewEvents = useCallback(async () => {
    if (latestEventTime === 0) return

    try {
      let newNotes: Event[]
      if (authorPubkey) {
        newNotes = await fetchUserPosts(authorPubkey, LIMITS.TIMELINE_FETCH_LIMIT, latestEventTime)
      } else {
        // mypace投稿の新着をチェック
        newNotes = await fetchEvents(
          LIMITS.TIMELINE_FETCH_LIMIT,
          latestEventTime,
          mypaceOnly,
          lang,
          0,
          showSNS,
          showBlog,
          hideAds,
          hideNSFW
        )
      }

      // 既存のイベントIDを除外
      const existingIds = new Set(events.map((e) => e.id))
      const trulyNew = newNotes.filter((e) => !existingIds.has(e.id) && e.created_at > latestEventTime)

      if (trulyNew.length > 0) {
        // ギャップ検出: 取得した最古のイベントがlatestEventTimeより古い場合、間にギャップあり
        const oldestNewTime = Math.min(...trulyNew.map((e) => e.created_at))
        const hasGap = trulyNew.length >= LIMITS.TIMELINE_FETCH_LIMIT && oldestNewTime > latestEventTime + 1

        if (hasGap) {
          // 新着の最古イベントを特定
          const oldestNewEvent = trulyNew.find((e) => e.created_at === oldestNewTime)
          if (oldestNewEvent) {
            const gapId = `gap-${latestEventTime}-${oldestNewTime}`
            setGaps((prev) => {
              if (prev.some((g) => g.id === gapId)) return prev
              return [
                ...prev,
                {
                  id: gapId,
                  afterEventId: oldestNewEvent.id,
                  since: latestEventTime,
                  until: oldestNewTime,
                },
              ]
            })
          }
        }

        setPendingNewEvents((prev) => {
          const prevIds = new Set(prev.map((e) => e.id))
          const unique = trulyNew.filter((e) => !prevIds.has(e.id))
          return [...prev, ...unique].sort((a, b) => b.created_at - a.created_at)
        })
      }
    } catch (err) {
      console.error('Failed to check new events:', err)
    }
  }, [latestEventTime, events, authorPubkey, mypaceOnly, showSNS, showBlog])

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const loadTimelineRef = useRef(loadTimeline)
  loadTimelineRef.current = loadTimeline

  useEffect(() => {
    loadTimelineRef.current()
    const handleNewPost = () => setTimeout(() => loadTimelineRef.current(), TIMEOUTS.NEW_POST_RELOAD)
    window.addEventListener(CUSTOM_EVENTS.NEW_POST, handleNewPost)
    return () => {
      window.removeEventListener(CUSTOM_EVENTS.NEW_POST, handleNewPost)
    }
  }, [authorPubkey, mypaceOnly, showSNS, showBlog])

  // 1分ごとのポーリング
  useEffect(() => {
    if (latestEventTime === 0) return

    // 既存のインターバルをクリア
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }

    pollingRef.current = setInterval(checkNewEvents, POLLING_INTERVAL)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [latestEventTime, checkNewEvents])

  // 古い投稿を読み込む（無限スクロール用）
  const loadOlderEvents = useCallback(async () => {
    if (loadingMore || !hasMore || oldestEventTime === 0) return

    setLoadingMore(true)
    try {
      let olderNotes: Event[]
      if (authorPubkey) {
        olderNotes = await fetchUserPosts(authorPubkey, LIMITS.TIMELINE_FETCH_LIMIT, 0, oldestEventTime)
      } else {
        // mypace投稿の過去分を取得
        olderNotes = await fetchEvents(
          LIMITS.TIMELINE_FETCH_LIMIT,
          0,
          mypaceOnly,
          lang,
          oldestEventTime, // until: この時刻より古いものを取得
          showSNS,
          showBlog,
          hideAds,
          hideNSFW
        )
      }

      if (olderNotes.length === 0) {
        setHasMore(false)
        return
      }

      // 既存のイベントIDを除外
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

        // 最古時刻を更新
        const minTime = Math.min(...newOlderNotes.map((e) => e.created_at))
        setOldestEventTime(minTime)

        // プロフィール取得
        const pubkeys = [...new Set(newOlderNotes.map((e) => e.pubkey))]
        try {
          const fetchedProfiles = await fetchProfiles(pubkeys)
          setProfiles((prev) => {
            const newProfiles = { ...prev }
            for (const pk of pubkeys) {
              if (newProfiles[pk] === undefined) {
                newProfiles[pk] = fetchedProfiles[pk] || null
              }
            }
            return newProfiles
          })
        } catch {}

        // まだ続きがあるか判定
        setHasMore(olderNotes.length >= LIMITS.TIMELINE_FETCH_LIMIT)
      } else {
        setHasMore(false)
      }
    } catch (err) {
      console.error('Failed to load older events:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, oldestEventTime, events, authorPubkey, mypaceOnly, showSNS, showBlog])

  // ギャップを埋める
  const fillGap = useCallback(
    async (gapId: string) => {
      const gap = gaps.find((g) => g.id === gapId)
      if (!gap || loadingGap) return

      setLoadingGap(gapId)
      try {
        let gapNotes: Event[]
        if (authorPubkey) {
          gapNotes = await fetchUserPosts(authorPubkey, LIMITS.TIMELINE_FETCH_LIMIT, gap.since, gap.until)
        } else {
          // mypace投稿のギャップを埋める
          gapNotes = await fetchEvents(
            LIMITS.TIMELINE_FETCH_LIMIT,
            gap.since, // since: この時刻より新しいもの
            mypaceOnly,
            lang,
            gap.until, // until: この時刻より古いもの
            showSNS,
            showBlog,
            hideAds,
            hideNSFW
          )
        }

        // 既存のイベントIDを除外
        const existingIds = new Set(events.map((e) => e.id))
        const newGapNotes = gapNotes.filter((e) => !existingIds.has(e.id))

        if (newGapNotes.length > 0) {
          const newItems: TimelineItem[] = newGapNotes.map((event) => ({ event }))
          setTimelineItems((prev) => {
            const merged = [...prev, ...newItems]
            merged.sort((a, b) => b.event.created_at - a.event.created_at)
            return merged
          })
          setEvents((prev) => {
            const merged = [...prev, ...newGapNotes]
            merged.sort((a, b) => b.created_at - a.created_at)
            return merged
          })

          // プロフィール取得
          const pubkeys = [...new Set(newGapNotes.map((e) => e.pubkey))]
          try {
            const fetchedProfiles = await fetchProfiles(pubkeys)
            setProfiles((prev) => {
              const newProfiles = { ...prev }
              for (const pk of pubkeys) {
                if (newProfiles[pk] === undefined) {
                  newProfiles[pk] = fetchedProfiles[pk] || null
                }
              }
              return newProfiles
            })
          } catch {}

          // まだギャップが残っているか確認
          const oldestGapTime = Math.min(...newGapNotes.map((e) => e.created_at))
          if (gapNotes.length >= LIMITS.TIMELINE_FETCH_LIMIT && oldestGapTime > gap.since + 1) {
            // まだギャップが残っている - 新しいギャップに更新
            setGaps((prev) =>
              prev.map((g) =>
                g.id === gapId
                  ? {
                      ...g,
                      until: oldestGapTime,
                      afterEventId: newGapNotes.find((e) => e.created_at === oldestGapTime)?.id || g.afterEventId,
                    }
                  : g
              )
            )
          } else {
            // ギャップを埋め切った - 削除
            setGaps((prev) => prev.filter((g) => g.id !== gapId))
          }
        } else {
          // 新しいイベントがなかった - ギャップを削除
          setGaps((prev) => prev.filter((g) => g.id !== gapId))
        }
      } catch (err) {
        console.error('Failed to fill gap:', err)
      } finally {
        setLoadingGap(null)
      }
    },
    [gaps, loadingGap, events, authorPubkey, mypaceOnly, showSNS, showBlog]
  )

  return {
    items: timelineItems,
    events,
    profiles,
    reactions,
    replies,
    reposts,
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
