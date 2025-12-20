import { useState, useEffect, useCallback } from 'react'
import { fetchEventById, fetchUserProfile, fetchReactions, fetchReplies, fetchReposts } from '../../lib/nostr/relay'
import { getCurrentPubkey } from '../../lib/nostr/events'
import { getCachedPost, getCachedProfile, getErrorMessage } from '../../lib/utils'
import type { Event, LoadableProfile, ReactionData, Profile } from '../../types'

interface PostViewData {
  event: Event | null
  profile: LoadableProfile
  myPubkey: string | null
  loading: boolean
  error: string
  reactions: ReactionData
  replies: { count: number; replies: Event[] }
  reposts: { count: number; myRepost: boolean }
  replyProfiles: { [pubkey: string]: Profile | null }
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
  const [replyProfiles, setReplyProfiles] = useState<{ [pubkey: string]: Profile | null }>({})

  const loadPost = useCallback(async () => {
    setError('')
    try {
      const pubkey = await getCurrentPubkey()
      setMyPubkey(pubkey)

      let eventData: Event | null = getCachedPost(eventId)

      if (eventData) {
        setEvent(eventData)
        setLoading(false)

        const cachedProfileData = getCachedProfile(eventData.pubkey)
        if (cachedProfileData) {
          setProfile(cachedProfileData)
        } else {
          fetchUserProfile(eventData.pubkey).then((userProfile) => {
            if (userProfile) setProfile(userProfile)
          })
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

        const userProfile = await fetchUserProfile(eventData.pubkey)
        if (userProfile) {
          setProfile(userProfile)
        }
      }

      if (!eventData) return

      const [reactionData, replyData, repostData] = await Promise.all([
        fetchReactions(eventId, pubkey),
        fetchReplies(eventId),
        fetchReposts(eventId, pubkey),
      ])

      setReactions(reactionData)
      setReplies(replyData)
      setReposts(repostData)

      const profiles: { [pubkey: string]: Profile | null } = {}
      const replyPubkeys = replyData.replies.map((r) => r.pubkey)
      const reactorPubkeys = reactionData.reactors.map((r) => r.pubkey)
      const allPubkeys = [...new Set([...replyPubkeys, ...reactorPubkeys])]
      for (const pk of allPubkeys) {
        try {
          const userProfile = await fetchUserProfile(pk)
          if (userProfile) profiles[pk] = userProfile
        } catch {}
      }
      setReplyProfiles(profiles)
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
    replyProfiles,
    setReactions,
    setReposts,
  }
}
