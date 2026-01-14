import { fetchProfiles, fetchReactions, fetchReplies, fetchReposts } from '../../lib/nostr/relay'
import { fetchViewCountsBatch, recordViewsBatch } from '../../lib/api/api'
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

// リアクション読み込み
export async function loadReactionsForEvents(
  events: Event[],
  myPubkey: string,
  currentProfiles: ProfileCache,
  setReactions: React.Dispatch<React.SetStateAction<{ [eventId: string]: ReactionData }>>,
  setProfiles: React.Dispatch<React.SetStateAction<ProfileCache>>
): Promise<void> {
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

// 返信読み込み
export async function loadRepliesForEvents(
  events: Event[],
  currentProfiles: ProfileCache,
  setReplies: React.Dispatch<React.SetStateAction<{ [eventId: string]: ReplyData }>>,
  setProfiles: React.Dispatch<React.SetStateAction<ProfileCache>>
): Promise<void> {
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

// リポスト読み込み
export async function loadRepostsForEvents(
  events: Event[],
  myPubkey: string,
  setReposts: React.Dispatch<React.SetStateAction<{ [eventId: string]: RepostData }>>
): Promise<void> {
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

// 閲覧数読み込み（mypaceタグ付き投稿のみ）
export async function loadViewsForEvents(
  events: Event[],
  setViews: React.Dispatch<React.SetStateAction<{ [eventId: string]: ViewCountData }>>
): Promise<void> {
  // mypaceタグ付き投稿のIDのみ抽出
  const mypaceEventIds = events.filter((e) => hasMypaceTag(e)).map((e) => e.id)
  if (mypaceEventIds.length === 0) return

  try {
    const viewsData = await fetchViewCountsBatch(mypaceEventIds)
    setViews((prev) => ({ ...prev, ...viewsData }))
  } catch {}
}

// インプレッション一括記録（mypaceタグ付き投稿のみ）
export async function recordImpressionsForEvents(events: Event[], viewerPubkey: string): Promise<void> {
  // mypaceタグ付き投稿の { eventId, authorPubkey } を抽出
  const mypaceEvents = events.filter((e) => hasMypaceTag(e)).map((e) => ({ eventId: e.id, authorPubkey: e.pubkey }))
  if (mypaceEvents.length === 0 || !viewerPubkey) return

  // fire-and-forget
  recordViewsBatch(mypaceEvents, 'impression', viewerPubkey).catch(() => {})
}
