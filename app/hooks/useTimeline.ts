import { useState, useEffect, useCallback } from 'hono/jsx'
import { fetchEvents, fetchUserProfile, fetchReactions, fetchReplies, fetchReposts, fetchRepostEvents, publishEvent } from '../lib/nostr/relay'
import { getCurrentPubkey, createDeleteEvent, createReactionEvent, createRepostEvent, MYPACE_TAG } from '../lib/nostr/events'
import { exportNpub } from '../lib/nostr/keys'
import type { Event } from 'nostr-tools'
import type { ProfileCache, ReactionData, ReplyData, RepostData, TimelineItem } from '../types/timeline'

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
        newProfiles[pubkey] = pe ? JSON.parse(pe.content) : null
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
          const eTag = r.tags.find(t => t[0] === 'e')
          return eTag && eTag[1] === eventId && (r.content === '+' || r.content === '')
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
        const eventReplies = replyEvents.filter(r => {
          const rootTag = r.tags.find(t => t[0] === 'e' && t[3] === 'root')
          return rootTag && rootTag[1] === eventId
        })
        replyMap[eventId] = { count: eventReplies.length, replies: eventReplies }
      }
      setReplies(replyMap)

      for (const pk of [...new Set(replyEvents.map(r => r.pubkey))]) {
        if (currentProfiles[pk] === undefined) {
          try {
            const pe = await fetchUserProfile(pk)
            if (pe) setProfiles(prev => ({ ...prev, [pk]: JSON.parse(pe.content) }))
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
        const eventReposts = repostEvents.filter(r => {
          const eTag = r.tags.find(t => t[0] === 'e')
          return eTag && eTag[1] === eventId
        })
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
            const originalEvent = JSON.parse(repost.content) as Event
            if (originalEvent.tags?.some(t => t[0] === 't' && t[1] === MYPACE_TAG)) {
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
              if (pe) setProfiles(prev => ({ ...prev, [pk]: JSON.parse(pe.content) }))
            }).catch(() => {})
          }
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline')
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
      setTimeout(loadTimeline, 1500)
    } catch {}
  }

  const getDisplayName = (pubkey: string): string => {
    const profile = profiles[pubkey]
    return profile?.display_name || profile?.name || exportNpub(pubkey).slice(0, 12) + '...'
  }

  const getAvatarUrl = (pubkey: string): string | null => profiles[pubkey]?.picture || null

  useEffect(() => {
    loadTimeline()
    const handleNewPost = () => setTimeout(loadTimeline, 1000)
    window.addEventListener('newpost', handleNewPost)
    return () => window.removeEventListener('newpost', handleNewPost)
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
