import { useState, useEffect, useCallback } from 'react'
import {
  fetchEventById,
  fetchEventsByIds,
  fetchProfiles,
  fetchEventMetadata,
  parseRepostEvent,
} from '../../lib/nostr/relay'
import { KIND_REPOST } from '../../lib/nostr/constants'
import { fetchViewsAndSuperMentions, recordImpressions } from '../../lib/api/api'
import { getCurrentPubkey, EMPTY_STELLA_COUNTS } from '../../lib/nostr/events'
import { getCachedPost, getCachedProfile, getCachedPostMetadata, getErrorMessage } from '../../lib/utils'
import { hasMypaceTag } from '../../lib/nostr/tags'
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
  replyProfiles: { [pubkey: string]: LoadableProfile }
  parentEvent: Event | null
  parentProfile: LoadableProfile
  setReactions: React.Dispatch<React.SetStateAction<ReactionData>>
  setReposts: React.Dispatch<React.SetStateAction<{ count: number; myRepost: boolean }>>
}

const initialReactions: ReactionData = {
  myReaction: false,
  myStella: { ...EMPTY_STELLA_COUNTS },
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
  const [replyProfiles, setReplyProfiles] = useState<{ [pubkey: string]: LoadableProfile }>({})
  const [parentEvent, setParentEvent] = useState<Event | null>(null)
  const [parentProfile, setParentProfile] = useState<LoadableProfile>(undefined)

  const loadPost = useCallback(async () => {
    setError('')
    setParentEvent(null)
    setParentProfile(undefined)
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
          fetchProfiles([eventPubkey]).then((profiles) => {
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

        const profilesData = await fetchProfiles([eventData.pubkey])
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
          recordImpressions([{ eventId, authorPubkey: eventData.pubkey }], 'detail', pubkey).catch(() => {})
        }

        // Batch fetch profiles for reply authors and reactors (from cached data)
        const replyPubkeys = cachedMetadata.replies.replies.map((r) => r.pubkey)
        const reactorPubkeys = cachedMetadata.reactions.reactors.map((r) => r.pubkey)
        // リポストの場合、元投稿者のプロフィールも取得
        const originalPubkey = eventData.kind === KIND_REPOST ? parseRepostEvent(eventData)?.pubkey : null
        const allPubkeys = [
          ...new Set([...replyPubkeys, ...reactorPubkeys, ...(originalPubkey ? [originalPubkey] : [])]),
        ]

        if (allPubkeys.length > 0) {
          try {
            const fetchedProfiles = await fetchProfiles(allPubkeys)
            const profiles: { [pubkey: string]: LoadableProfile } = {}
            for (const pk of allPubkeys) {
              profiles[pk] = fetchedProfiles[pk] as LoadableProfile
            }
            setReplyProfiles(profiles)
          } catch {}
        }

        // Fetch parent event if this is a reply
        const replyTag = eventData.tags.find((tag) => tag[0] === 'e' && (tag[3] === 'reply' || tag[3] === 'root'))
        if (replyTag) {
          const parentId = replyTag[1]
          try {
            const parentEvents = await fetchEventsByIds([parentId])
            const parent = parentEvents[parentId]
            if (parent) {
              setParentEvent(parent as Event)
              const parentProfiles = await fetchProfiles([parent.pubkey])
              if (parentProfiles[parent.pubkey]) {
                setParentProfile(parentProfiles[parent.pubkey] as Profile)
              }
            }
          } catch {}
        }
        return
      }

      // Fetch all metadata + views in parallel (only when not cached)
      // Profile is already fetched above, so we only fetch metadata and views here
      const [metadata, { views: viewsData }] = await Promise.all([
        fetchEventMetadata([eventId], pubkey || undefined),
        fetchViewsAndSuperMentions([eventId], []),
      ])
      const eventMetadata = metadata[eventId]

      if (eventMetadata) {
        setReactions(eventMetadata.reactions)
        setReplies(eventMetadata.replies)
        setReposts(eventMetadata.reposts)
      }
      setViews(viewsData[eventId] || { impression: 0, detail: 0 })

      // Record detail view for mypace posts
      if (hasMypaceTag(eventData) && pubkey) {
        recordImpressions([{ eventId, authorPubkey: eventData.pubkey }], 'detail', pubkey).catch(() => {})
      }

      // Fetch profiles for reply authors and reactors
      const replyPubkeys = eventMetadata?.replies.replies.map((r) => r.pubkey) || []
      const reactorPubkeys = eventMetadata?.reactions.reactors.map((r) => r.pubkey) || []
      // リポストの場合、元投稿者のプロフィールも取得
      const originalPubkey = eventData.kind === KIND_REPOST ? parseRepostEvent(eventData)?.pubkey : null
      const allPubkeys = [...new Set([...replyPubkeys, ...reactorPubkeys, ...(originalPubkey ? [originalPubkey] : [])])]

      if (allPubkeys.length > 0) {
        const replyReactorProfiles = await fetchProfiles(allPubkeys)
        const profiles: { [pubkey: string]: LoadableProfile } = {}
        for (const pk of allPubkeys) {
          profiles[pk] = replyReactorProfiles[pk] as LoadableProfile
        }
        setReplyProfiles(profiles)
      }

      // Fetch parent event if this is a reply
      const replyTag = eventData.tags.find((tag) => tag[0] === 'e' && (tag[3] === 'reply' || tag[3] === 'root'))
      if (replyTag) {
        const parentId = replyTag[1]
        try {
          const parentEvents = await fetchEventsByIds([parentId])
          const parent = parentEvents[parentId]
          if (parent) {
            setParentEvent(parent as Event)
            const parentProfiles = await fetchProfiles([parent.pubkey])
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
