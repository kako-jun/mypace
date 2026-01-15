import { useEffect, useRef, useCallback } from 'react'
import { fetchEvents, fetchUserPosts } from '../../lib/nostr/relay'
import { LIMITS } from '../../lib/constants'
import type { Event, ProfileCache, TimelineItem } from '../../types'
import type { UseTimelineOptions } from './types'
import { mergeProfiles } from './useTimelineData'

export const POLLING_INTERVAL = 60 * 1000 // 1分

interface UseTimelinePollingOptions {
  options: UseTimelineOptions
  latestEventTime: number
  events: Event[]
  setPendingNewEvents: React.Dispatch<React.SetStateAction<Event[]>>
  setProfiles: React.Dispatch<React.SetStateAction<ProfileCache>>
  setTimelineItems: React.Dispatch<React.SetStateAction<TimelineItem[]>>
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>
  setLatestEventTime: React.Dispatch<React.SetStateAction<number>>
  pendingNewEvents: Event[]
}

export function useTimelinePolling({
  options,
  latestEventTime,
  events,
  setPendingNewEvents,
  setProfiles,
  setTimelineItems,
  setEvents,
  setLatestEventTime,
  pendingNewEvents,
}: UseTimelinePollingOptions) {
  const { authorPubkey, tags, q } = options
  // Serialize arrays for stable dependency comparison
  const tagsKey = tags ? JSON.stringify(tags) : ''
  const qKey = q ? JSON.stringify(q) : ''
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 新着チェック（ポーリング）
  const checkNewEvents = useCallback(async () => {
    if (latestEventTime === 0) return

    try {
      let newNotes: Event[]
      if (authorPubkey) {
        const result = await fetchUserPosts(authorPubkey, {
          limit: LIMITS.TIMELINE_FETCH_LIMIT,
          since: latestEventTime,
          tags,
          q,
        })
        newNotes = result.events
      } else {
        const result = await fetchEvents({ limit: LIMITS.TIMELINE_FETCH_LIMIT, since: latestEventTime, q, tags })
        newNotes = result.events
      }

      // 既存のイベントIDを除外
      const existingIds = new Set(events.map((e) => e.id))
      const trulyNew = newNotes.filter((e) => !existingIds.has(e.id) && e.created_at > latestEventTime)

      if (trulyNew.length > 0) {
        setPendingNewEvents((prev) => {
          const prevIds = new Set(prev.map((e) => e.id))
          const unique = trulyNew.filter((e) => !prevIds.has(e.id))
          const merged = [...prev, ...unique].sort((a, b) => b.created_at - a.created_at)
          // 200件を超えたら古い方を削除（新しい方を保持）
          return merged.slice(0, LIMITS.MAX_TIMELINE_ITEMS)
        })
      }
    } catch (err) {
      console.error('Failed to check new events:', err)
    }
  }, [latestEventTime, events, authorPubkey, tagsKey, qKey, setPendingNewEvents])

  // 1分ごとのポーリング
  useEffect(() => {
    if (latestEventTime === 0) return

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

  // 新着イベントをタイムラインに反映
  // 新しい投稿を上に追加 → 200件を超えたら下（過去方向）から削除
  const loadNewEvents = useCallback(async () => {
    if (pendingNewEvents.length === 0) return

    const newItems: TimelineItem[] = pendingNewEvents.map((event) => ({ event }))
    setTimelineItems((prev) => {
      const existingIds = new Set(prev.map((item) => item.event.id))
      const uniqueNewItems = newItems.filter((item) => !existingIds.has(item.event.id))
      const merged = [...uniqueNewItems, ...prev]
      merged.sort((a, b) => b.event.created_at - a.event.created_at)
      // Trim from bottom (older items) if exceeding limit
      return merged.slice(0, LIMITS.MAX_TIMELINE_ITEMS)
    })
    setEvents((prev) => {
      const existingIds = new Set(prev.map((e) => e.id))
      const uniqueNew = pendingNewEvents.filter((e) => !existingIds.has(e.id))
      const merged = [...uniqueNew, ...prev].sort((a, b) => b.created_at - a.created_at)
      // Trim from bottom (older items) if exceeding limit
      return merged.slice(0, LIMITS.MAX_TIMELINE_ITEMS)
    })

    // 新着イベントの最新時刻を記録
    if (pendingNewEvents.length > 0) {
      const maxTime = Math.max(...pendingNewEvents.map((e) => e.created_at))
      setLatestEventTime((prev) => Math.max(prev, maxTime))
    }

    // プロフィール取得
    const pubkeys = [...new Set(pendingNewEvents.map((e) => e.pubkey))]
    await mergeProfiles(pubkeys, setProfiles)

    setPendingNewEvents([])
  }, [pendingNewEvents, setTimelineItems, setEvents, setLatestEventTime, setProfiles, setPendingNewEvents])

  return { loadNewEvents, checkNewEvents }
}
