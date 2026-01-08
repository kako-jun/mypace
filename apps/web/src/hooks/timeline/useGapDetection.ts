import { useCallback } from 'react'
import { fetchEvents, fetchUserPosts } from '../../lib/nostr/relay'
import { LIMITS } from '../../lib/constants'
import type { Event, ProfileCache, TimelineItem } from '../../types'
import type { GapInfo, UseTimelineOptions } from './types'
import { mergeProfiles } from './useTimelineData'

interface UseGapDetectionOptions {
  options: UseTimelineOptions
  gaps: GapInfo[]
  loadingGap: string | null
  events: Event[]
  setGaps: React.Dispatch<React.SetStateAction<GapInfo[]>>
  setLoadingGap: React.Dispatch<React.SetStateAction<string | null>>
  setTimelineItems: React.Dispatch<React.SetStateAction<TimelineItem[]>>
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>
  setProfiles: React.Dispatch<React.SetStateAction<ProfileCache>>
}

export function useGapDetection({
  options,
  gaps,
  loadingGap,
  events,
  setGaps,
  setLoadingGap,
  setTimelineItems,
  setEvents,
  setProfiles,
}: UseGapDetectionOptions) {
  const { authorPubkey, tags, q } = options

  // ギャップを埋める
  const fillGap = useCallback(
    async (gapId: string) => {
      const gap = gaps.find((g) => g.id === gapId)
      if (!gap || loadingGap) return

      setLoadingGap(gapId)
      try {
        let gapNotes: Event[]
        if (authorPubkey) {
          gapNotes = await fetchUserPosts(authorPubkey, {
            limit: LIMITS.TIMELINE_FETCH_LIMIT,
            since: gap.since,
            until: gap.until,
            tags,
            q,
          })
        } else {
          gapNotes = await fetchEvents({
            limit: LIMITS.TIMELINE_FETCH_LIMIT,
            since: gap.since,
            until: gap.until,
            q,
            tags,
          })
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
          await mergeProfiles(pubkeys, setProfiles)

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
    [gaps, loadingGap, events, authorPubkey, tags, q, setGaps, setLoadingGap, setTimelineItems, setEvents, setProfiles]
  )

  return { fillGap }
}
