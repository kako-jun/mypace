import { useState, useEffect, useCallback } from 'hono/jsx'
import { fetchEvents, fetchUserProfile, fetchReactions, fetchReplies, fetchReposts, fetchRepostEvents, publishEvent } from '../lib/nostr/relay'
import { getCurrentPubkey, createDeleteEvent, createReactionEvent, createRepostEvent } from '../lib/nostr/events'
import { getETagValue, filterRepliesByRoot, hasMypaceTag } from '../lib/nostr/tags'
import { getDisplayNameFromCache, getAvatarUrlFromCache, parseProfile, parseEventJson, getErrorMessage } from '../lib/utils'
import { isValidReaction, TIMEOUTS, CUSTOM_EVENTS } from '../lib/constants'
import type { Event } from 'nostr-tools'
import type { ProfileCache, ReactionData, ReplyData, RepostData, TimelineItem } from '../types'

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
  reload: () => void
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

  const loadProfiles = async (events: Event[], currentProfiles: ProfileCache) => {
    const pubkeys = [...new Set(events.map(e => e.pubkey))]
    const newProfiles: ProfileCache = { ...currentProfiles }
    for (const pubkey of pubkeys) {
      if (newProfiles[pubkey] !== undefined) continue
      try {
        const pe = await fetchUserProfile(pubkey)
        newProfiles[pubkey] = pe ? parseProfile(pe.content) : null
      } catch {
        newProfiles[pubkey] = null
      }
    }
    setProfiles(newProfiles)
    return newProfiles
  }

  const loadReactions = async (events: Event[], myPubkey: string) => {
    const eventIds = events.map(e => e.id)
    try {
      const reactionEvents = await fetchReactions(eventIds)
      const reactionMap: { [eventId: string]: ReactionData } = {}
      for (const eventId of eventIds) {
        const eventReactions = reactionEvents.filter(r => {
          return getETagValue(r.tags) === eventId && isValidReaction(r.content)
        })
        reactionMap[eventId] = {
          count: eventReactions.length,
          myReaction: eventReactions.some(r => r.pubkey === myPubkey)
        }
      }
      setReactions(reactionMap)
    } catch {}
  }

  const loadRepliesData = async (events: Event[], currentProfiles: ProfileCache) => {
    const eventIds = events.map(e => e.id)
    try {
      const replyEvents = await fetchReplies(eventIds)
      const replyMap: { [eventId: string]: ReplyData } = {}
      for (const eventId of eventIds) {
        const eventReplies = filterRepliesByRoot(replyEvents, eventId)
        replyMap[eventId] = { count: eventReplies.length, replies: eventReplies }
      }
      setReplies(replyMap)

      for (const pk of [...new Set(replyEvents.map(r => r.pubkey))]) {
        if (currentProfiles[pk] === undefined) {
          try {
            const pe = await fetchUserProfile(pk)
            if (pe) setProfiles(prev => ({ ...prev, [pk]: parseProfile(pe.content) }))
          } catch {}
        }
      }
    } catch {}
  }

  const loadRepostsData = async (events: Event[], myPubkey: string) => {
    const eventIds = events.map(e => e.id)
    try {
      const repostEvents = await fetchReposts(eventIds)
      const repostMap: { [eventId: string]: RepostData } = {}
      for (const eventId of eventIds) {
        const eventReposts = repostEvents.filter(r => getETagValue(r.tags) === eventId)
        repostMap[eventId] = {
          count: eventReposts.length,
          myRepost: eventReposts.some(r => r.pubkey === myPubkey)
        }
      }
      setReposts(repostMap)
    } catch {}
  }

  const loadTimeline = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const pubkey = await getCurrentPubkey()
      setMyPubkey(pubkey)

      let notes: Event[] = []
      const res = await fetch('/api/timeline?limit=50')
      if (res.ok) {
        const data = await res.json() as { events: Event[] }
        notes = data.events
      } else {
        notes = await fetchEvents({ kinds: [1] }, 50)
      }

      const initialItems: TimelineItem[] = notes.map(note => ({ event: note }))
      initialItems.sort((a, b) => b.event.created_at - a.event.created_at)
      setTimelineItems(initialItems)
      setEvents(notes)
      setLoading(false)

      const loadedProfiles = await loadProfiles(notes, profiles)
      Promise.all([
        loadReactions(notes, pubkey),
        loadRepliesData(notes, loadedProfiles),
        loadRepostsData(notes, pubkey),
      ])

      fetchRepostEvents(50).then(async repostEvents => {
        const items: TimelineItem[] = [...initialItems]
        const allOriginalEvents: Event[] = [...notes]

        for (const repost of repostEvents) {
          try {
            if (!repost.content || repost.content.trim() === '') continue
            const originalEvent = parseEventJson<Event>(repost.content)
            if (!originalEvent) continue
            if (hasMypaceTag(originalEvent)) {
              items.push({
                event: originalEvent,
                repostedBy: { pubkey: repost.pubkey, timestamp: repost.created_at }
              })
              if (!allOriginalEvents.some(e => e.id === originalEvent.id)) {
                allOriginalEvents.push(originalEvent)
              }
            }
          } catch {}
        }

        items.sort((a, b) => (b.repostedBy?.timestamp || b.event.created_at) - (a.repostedBy?.timestamp || a.event.created_at))
        setTimelineItems(items)
        setEvents(allOriginalEvents)

        for (const pk of [...new Set(items.filter(i => i.repostedBy).map(i => i.repostedBy!.pubkey))]) {
          if (profiles[pk] === undefined) {
            fetchUserProfile(pk).then(pe => {
              if (pe) setProfiles(prev => ({ ...prev, [pk]: parseProfile(pe.content) }))
            }).catch(() => {})
          }
        }
      })
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
      setReactions(prev => ({
        ...prev,
        [event.id]: { count: (prev[event.id]?.count || 0) + 1, myReaction: true }
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
      setReposts(prev => ({
        ...prev,
        [event.id]: { count: (prev[event.id]?.count || 0) + 1, myRepost: true }
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

  const getDisplayName = (pubkey: string): string => getDisplayNameFromCache(pubkey, profiles)
  const getAvatarUrl = (pubkey: string): string | null => getAvatarUrlFromCache(pubkey, profiles)

  useEffect(() => {
    loadTimeline()
    const handleNewPost = () => setTimeout(loadTimeline, TIMEOUTS.NEW_POST_RELOAD)
    window.addEventListener(CUSTOM_EVENTS.NEW_POST, handleNewPost)
    return () => window.removeEventListener(CUSTOM_EVENTS.NEW_POST, handleNewPost)
  }, [])

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
    reload: loadTimeline,
    handleLike,
    handleRepost,
    handleDelete,
    getDisplayName,
    getAvatarUrl,
  }
}
