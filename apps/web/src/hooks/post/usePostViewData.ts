import { useState, useEffect, useCallback } from 'react'
import { fetchEventById } from '../../lib/nostr/relay'
import { getCurrentPubkey } from '../../lib/nostr/events'
import { getCachedPost, getCachedProfile, getCachedPostMetadata, getErrorMessage } from '../../lib/utils'
import { hasMypaceTag } from '../../lib/nostr/tags'
import { fetchEventsEnrich, fetchEventsBatch, recordViews } from '../../lib/api/api'
import type { Event, LoadableProfile, ReactionData, Profile, ViewCountData } from '../../types'

interface PostViewData {
  event: Event | null
  profile: LoadableProfile
  myPubkey: string | null
  loading: boolean
  error: string
  reactions: ReactionData
  replies: { count: number; replies: Event[] }
  reposts: { count: number; myRepost: boolean }
  views: ViewCountData | undefined
  replyProfiles: { [pubkey: string]: Profile | null }
  parentEvent: Event | null
  parentProfile: Profile | null
  setReactions: React.Dispatch<React.SetStateAction<ReactionData>>
  setReposts: React.Dispatch<React.SetStateAction<{ count: number; myRepost: boolean }>>
}

const initialReactions: ReactionData = {
  count: 0,
  myReaction: false,
  myStella: 0,
  myReactionId: null,
  reactors: [],
}

export function usePostViewData(eventId: string): PostViewData {
  const [event, setEvent] = useState<Event | null>(null)
  const [profile, setProfile] = useState<LoadableProfile>(undefined)
  const [myPubkey, setMyPubkey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reactions, setReactions] = useState<ReactionData>(initialReactions)
  const [replies, setReplies] = useState<{ count: number; replies: Event[] }>({ count: 0, replies: [] })
  const [reposts, setReposts] = useState({ count: 0, myRepost: false })
  const [views, setViews] = useState<ViewCountData | undefined>(undefined)
  const [replyProfiles, setReplyProfiles] = useState<{ [pubkey: string]: Profile | null }>({})
  const [parentEvent, setParentEvent] = useState<Event | null>(null)
  const [parentProfile, setParentProfile] = useState<Profile | null>(null)

  const loadPost = useCallback(async () => {
    setError('')
    setParentEvent(null)
    setParentProfile(null)
    try {
      const pubkey = await getCurrentPubkey()
      setMyPubkey(pubkey)

      let eventData: Event | null = getCachedPost(eventId)
      const cachedMetadata = getCachedPostMetadata(eventId)

      if (eventData) {
        setEvent(eventData)
        setLoading(false)

        const cachedProfileData = getCachedProfile(eventData.pubkey)
        if (cachedProfileData) {
          setProfile(cachedProfileData)
        } else {
          const eventPubkey = eventData.pubkey
          fetchEventsEnrich([], [eventPubkey], undefined, []).then(({ profiles }) => {
            if (profiles[eventPubkey]) setProfile(profiles[eventPubkey] as Profile)
          })
        }

        // Use cached metadata from timeline if available (instant display)
        if (cachedMetadata) {
          setReactions(cachedMetadata.reactions)
          setReplies(cachedMetadata.replies)
          setReposts(cachedMetadata.reposts)
          setViews(cachedMetadata.views)
        }
      } else {
        setLoading(true)
        eventData = await fetchEventById(eventId)
        if (!eventData) {
          setError('Post not found')
          setLoading(false)
          return
        }
        setEvent(eventData)
        setLoading(false)

        const { profiles: profilesData } = await fetchEventsEnrich([], [eventData.pubkey], undefined, [])
        if (profilesData[eventData.pubkey]) {
          setProfile(profilesData[eventData.pubkey] as Profile)
        }
      }

      if (!eventData) return

      // Skip API fetch if we already have cached metadata from timeline
      // This avoids unnecessary network requests and keeps the UI consistent
      if (cachedMetadata) {
        // Record detail view for mypace posts (still needed even with cached data)
        if (hasMypaceTag(eventData) && pubkey) {
          recordViews([{ eventId, authorPubkey: eventData.pubkey }], 'detail', pubkey).catch(() => {})
        }

        // Batch fetch profiles for reply authors and reactors (from cached data)
        const replyPubkeys = cachedMetadata.replies.replies.map((r) => r.pubkey)
        const reactorPubkeys = cachedMetadata.reactions.reactors.map((r) => r.pubkey)
        const allPubkeys = [...new Set([...replyPubkeys, ...reactorPubkeys])]

        if (allPubkeys.length > 0) {
          try {
            const { profiles: fetchedProfiles } = await fetchEventsEnrich([], allPubkeys, undefined, [])
            const profiles: { [pubkey: string]: Profile | null } = {}
            for (const pk of allPubkeys) {
              profiles[pk] = (fetchedProfiles[pk] as Profile) || null
            }
            setReplyProfiles(profiles)
          } catch {}
        }

        // Fetch parent event if this is a reply
        const replyTag = eventData.tags.find((tag) => tag[0] === 'e' && (tag[3] === 'reply' || tag[3] === 'root'))
        if (replyTag) {
          const parentId = replyTag[1]
          try {
            const parentEvents = await fetchEventsBatch([parentId])
            const parent = parentEvents[parentId]
            if (parent) {
              setParentEvent(parent as Event)
              const { profiles: parentProfiles } = await fetchEventsEnrich([], [parent.pubkey], undefined, [])
              if (parentProfiles[parent.pubkey]) {
                setParentProfile(parentProfiles[parent.pubkey] as Profile)
              }
            }
          } catch {}
        }
        return
      }

      // Fetch all metadata + profiles in one call (only when not cached)
      const { metadata, profiles: fetchedProfiles } = await fetchEventsEnrich([eventId], [eventData.pubkey], pubkey, [])
      const eventMetadata = metadata[eventId]

      if (eventMetadata) {
        setReactions(eventMetadata.reactions)
        setReplies(eventMetadata.replies)
        setReposts(eventMetadata.reposts)
        setViews(eventMetadata.views)
      }

      // Record detail view for mypace posts
      if (hasMypaceTag(eventData) && pubkey) {
        recordViews([{ eventId, authorPubkey: eventData.pubkey }], 'detail', pubkey).catch(() => {})
      }

      // Use profiles from enrich response for reply authors and reactors
      const replyPubkeys = eventMetadata?.replies.replies.map((r) => r.pubkey) || []
      const reactorPubkeys = eventMetadata?.reactions.reactors.map((r) => r.pubkey) || []
      const allPubkeys = [...new Set([...replyPubkeys, ...reactorPubkeys])]

      if (allPubkeys.length > 0) {
        const profiles: { [pubkey: string]: Profile | null } = {}
        for (const pk of allPubkeys) {
          profiles[pk] = (fetchedProfiles[pk] as Profile) || null
        }
        setReplyProfiles(profiles)
      }

      // Fetch parent event if this is a reply
      const replyTag = eventData.tags.find((tag) => tag[0] === 'e' && (tag[3] === 'reply' || tag[3] === 'root'))
      if (replyTag) {
        const parentId = replyTag[1]
        try {
          // Use batch API for parent event
          const parentEvents = await fetchEventsBatch([parentId])
          const parent = parentEvents[parentId]
          if (parent) {
            setParentEvent(parent as Event)
            const { profiles: parentProfiles } = await fetchEventsEnrich([], [parent.pubkey], undefined, [])
            if (parentProfiles[parent.pubkey]) {
              setParentProfile(parentProfiles[parent.pubkey] as Profile)
            }
          }
        } catch {}
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load post'))
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    loadPost()
  }, [loadPost])

  return {
    event,
    profile,
    myPubkey,
    loading,
    error,
    reactions,
    replies,
    reposts,
    views,
    replyProfiles,
    parentEvent,
    parentProfile,
    setReactions,
    setReposts,
  }
}
