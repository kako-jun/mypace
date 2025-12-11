import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchEvents,
  fetchProfiles,
  fetchReactions,
  fetchReplies,
  fetchReposts,
  publishEvent,
} from '../lib/nostr/relay'
import { getCurrentPubkey, createDeleteEvent, createReactionEvent, createRepostEvent } from '../lib/nostr/events'
import { getDisplayNameFromCache, getAvatarUrlFromCache, getErrorMessage, getBoolean, getString } from '../lib/utils'
import { TIMEOUTS, CUSTOM_EVENTS, LIMITS, STORAGE_KEYS } from '../lib/constants'
import type { Event, ProfileCache, ReactionData, ReplyData, RepostData, TimelineItem } from '../types'

const POLLING_INTERVAL = 60 * 1000 // 1分

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
  reload: () => void
  loadNewEvents: () => void
  handleLike: (event: Event) => Promise<void>
  handleRepost: (event: Event) => Promise<void>
  handleDelete: (event: Event) => Promise<void>
  getDisplayName: (pubkey: string) => string
  getAvatarUrl: (pubkey: string) => string | null
}

export function useTimeline(): UseTimelineResult {
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

  const loadReactionsForEvents = async (events: Event[], myPubkey: string) => {
    const reactionMap: { [eventId: string]: ReactionData } = {}
    await Promise.all(
      events.map(async (event) => {
        try {
          const result = await fetchReactions(event.id, myPubkey)
          reactionMap[event.id] = result
        } catch {
          reactionMap[event.id] = { count: 0, myReaction: false }
        }
      })
    )
    setReactions(reactionMap)
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
        setProfiles((prev) => ({ ...prev, ...fetchedProfiles }))
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
    setLoading(true)
    setError('')
    try {
      const pubkey = await getCurrentPubkey()
      setMyPubkey(pubkey)

      const mypaceOnly = getBoolean(STORAGE_KEYS.MYPACE_ONLY, true)
      const language = getString(STORAGE_KEYS.LANGUAGE_FILTER) || ''
      const notes = await fetchEvents(LIMITS.TIMELINE_FETCH_LIMIT, 0, mypaceOnly, language)

      const initialItems: TimelineItem[] = notes.map((note) => ({ event: note }))
      initialItems.sort((a, b) => b.event.created_at - a.event.created_at)
      setTimelineItems(initialItems)
      setEvents(notes)
      setLoading(false)

      // リアルタイム購読用に最新イベント時刻を記録
      if (notes.length > 0) {
        const maxTime = Math.max(...notes.map((n) => n.created_at))
        setLatestEventTime(maxTime)
      } else {
        setLatestEventTime(Math.floor(Date.now() / 1000))
      }

      const loadedProfiles = await loadProfiles(notes, profiles)
      await Promise.all([
        loadReactionsForEvents(notes, pubkey),
        loadRepliesForEvents(notes, loadedProfiles),
        loadRepostsForEvents(notes, pubkey),
      ])
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load timeline'))
      setLoading(false)
    }
  }, [])

  const handleLike = async (event: Event) => {
    if (likingId || !myPubkey || reactions[event.id]?.myReaction) return
    setLikingId(event.id)
    try {
      await publishEvent(await createReactionEvent(event, '+'))
      setReactions((prev) => ({
        ...prev,
        [event.id]: { count: (prev[event.id]?.count || 0) + 1, myReaction: true },
      }))
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

    // プロフィール取得
    await loadProfiles(pendingNewEvents, profiles)

    setPendingNewEvents([])
  }, [pendingNewEvents, profiles])

  // 新着チェック（ポーリング）
  const checkNewEvents = useCallback(async () => {
    if (latestEventTime === 0) return

    try {
      const mypaceOnly = getBoolean(STORAGE_KEYS.MYPACE_ONLY, true)
      const language = getString(STORAGE_KEYS.LANGUAGE_FILTER) || ''
      const newNotes = await fetchEvents(LIMITS.TIMELINE_FETCH_LIMIT, latestEventTime, mypaceOnly, language)

      // 既存のイベントIDを除外
      const existingIds = new Set(events.map((e) => e.id))
      const trulyNew = newNotes.filter((e) => !existingIds.has(e.id) && e.created_at > latestEventTime)

      if (trulyNew.length > 0) {
        setPendingNewEvents((prev) => {
          const prevIds = new Set(prev.map((e) => e.id))
          const unique = trulyNew.filter((e) => !prevIds.has(e.id))
          return [...prev, ...unique].sort((a, b) => b.created_at - a.created_at)
        })
      }
    } catch (err) {
      console.error('Failed to check new events:', err)
    }
  }, [latestEventTime, events])

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const loadTimelineRef = useRef(loadTimeline)
  loadTimelineRef.current = loadTimeline

  useEffect(() => {
    loadTimelineRef.current()
    const handleNewPost = () => setTimeout(() => loadTimelineRef.current(), TIMEOUTS.NEW_POST_RELOAD)
    const handleFilterChanged = () => {
      setPendingNewEvents([])
      loadTimelineRef.current()
    }
    window.addEventListener(CUSTOM_EVENTS.NEW_POST, handleNewPost)
    window.addEventListener(CUSTOM_EVENTS.MYPACE_FILTER_CHANGED, handleFilterChanged)
    window.addEventListener(CUSTOM_EVENTS.LANGUAGE_FILTER_CHANGED, handleFilterChanged)
    return () => {
      window.removeEventListener(CUSTOM_EVENTS.NEW_POST, handleNewPost)
      window.removeEventListener(CUSTOM_EVENTS.MYPACE_FILTER_CHANGED, handleFilterChanged)
      window.removeEventListener(CUSTOM_EVENTS.LANGUAGE_FILTER_CHANGED, handleFilterChanged)
    }
  }, [])

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
    reload: loadTimeline,
    loadNewEvents,
    handleLike,
    handleRepost,
    handleDelete,
    getDisplayName,
    getAvatarUrl,
  }
}
