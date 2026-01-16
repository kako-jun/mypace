import { fetchProfiles } from '../../lib/nostr/relay'
import { fetchEventsMetadata, recordViews } from '../../lib/api/api'
import { hasMypaceTag } from '../../lib/nostr/tags'
import type { Event, ProfileCache, ReactionData, ReplyData, RepostData, ViewCountData } from '../../types'

// プロフィール読み込み
export async function loadProfiles(
  events: Event[],
  currentProfiles: ProfileCache,
  setProfiles: React.Dispatch<React.SetStateAction<ProfileCache>>
): Promise<ProfileCache> {
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

// メタデータ一括読み込み（reactions, replies, reposts, views）
export async function loadMetadataForEvents(
  events: Event[],
  myPubkey: string,
  setReactions: React.Dispatch<React.SetStateAction<{ [eventId: string]: ReactionData }>>,
  setReplies: React.Dispatch<React.SetStateAction<{ [eventId: string]: ReplyData }>>,
  setReposts: React.Dispatch<React.SetStateAction<{ [eventId: string]: RepostData }>>,
  setViews: React.Dispatch<React.SetStateAction<{ [eventId: string]: ViewCountData }>>,
  setProfiles: React.Dispatch<React.SetStateAction<ProfileCache>>
): Promise<void> {
  if (events.length === 0) return

  const eventIds = events.map((e) => e.id)

  try {
    const metadata = await fetchEventsMetadata(eventIds, myPubkey)

    // Batch update all states
    const reactionMap: { [eventId: string]: ReactionData } = {}
    const replyMap: { [eventId: string]: ReplyData } = {}
    const repostMap: { [eventId: string]: RepostData } = {}
    const viewMap: { [eventId: string]: ViewCountData } = {}
    const allPubkeys: string[] = []

    for (const eventId of eventIds) {
      const data = metadata[eventId]
      if (data) {
        reactionMap[eventId] = data.reactions
        replyMap[eventId] = data.replies
        repostMap[eventId] = data.reposts
        viewMap[eventId] = data.views

        // Collect pubkeys for profile loading
        data.reactions.reactors.forEach((r) => allPubkeys.push(r.pubkey))
        data.replies.replies.forEach((r) => allPubkeys.push(r.pubkey))
      } else {
        // Initialize with defaults if not found
        reactionMap[eventId] = { count: 0, myReaction: false, myStella: 0, myReactionId: null, reactors: [] }
        replyMap[eventId] = { count: 0, replies: [] }
        repostMap[eventId] = { count: 0, myRepost: false }
        viewMap[eventId] = { impression: 0, detail: 0 }
      }
    }

    setReactions(reactionMap)
    setReplies(replyMap)
    setReposts(repostMap)
    setViews(viewMap)

    // Load profiles for reactors and reply authors
    const uniquePubkeys = [...new Set(allPubkeys)]
    if (uniquePubkeys.length > 0) {
      try {
        const fetchedProfiles = await fetchProfiles(uniquePubkeys)
        setProfiles((prev) => {
          const newProfiles = { ...prev }
          for (const pk of uniquePubkeys) {
            if (newProfiles[pk] === undefined) {
              newProfiles[pk] = fetchedProfiles[pk] || null
            }
          }
          return newProfiles
        })
      } catch {}
    }
  } catch (error) {
    console.error('Failed to load metadata:', error)
    // Initialize with empty values on error
    const reactionMap: { [eventId: string]: ReactionData } = {}
    const replyMap: { [eventId: string]: ReplyData } = {}
    const repostMap: { [eventId: string]: RepostData } = {}
    const viewMap: { [eventId: string]: ViewCountData } = {}

    for (const eventId of eventIds) {
      reactionMap[eventId] = { count: 0, myReaction: false, myStella: 0, myReactionId: null, reactors: [] }
      replyMap[eventId] = { count: 0, replies: [] }
      repostMap[eventId] = { count: 0, myRepost: false }
      viewMap[eventId] = { impression: 0, detail: 0 }
    }

    setReactions(reactionMap)
    setReplies(replyMap)
    setReposts(repostMap)
    setViews(viewMap)
  }
}

// プロフィールをマージして更新
export async function mergeProfiles(
  pubkeys: string[],
  setProfiles: React.Dispatch<React.SetStateAction<ProfileCache>>
): Promise<void> {
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
}

// インプレッション一括記録（mypaceタグ付き投稿のみ）
export async function recordImpressionsForEvents(events: Event[], viewerPubkey: string): Promise<void> {
  // mypaceタグ付き投稿の { eventId, authorPubkey } を抽出
  const mypaceEvents = events.filter((e) => hasMypaceTag(e)).map((e) => ({ eventId: e.id, authorPubkey: e.pubkey }))
  if (mypaceEvents.length === 0 || !viewerPubkey) return

  // fire-and-forget
  recordViews(mypaceEvents, 'impression', viewerPubkey).catch(() => {})
}
