import { fetchEventsEnrich, fetchOgpBatch, recordViews } from '../../lib/api/api'
import { hasMypaceTag } from '../../lib/nostr/tags'
import { extractFromContents } from '../../lib/utils/content'
import type { Event, ProfileCache, ReactionData, ReplyData, RepostData, ViewCountData, OgpData } from '../../types'

// イベントのエンリッチメント一括読み込み（metadata + profiles + super-mentions）
export async function loadEnrichForEvents(
  events: Event[],
  viewerPubkey: string,
  setReactions: React.Dispatch<React.SetStateAction<{ [eventId: string]: ReactionData }>>,
  setReplies: React.Dispatch<React.SetStateAction<{ [eventId: string]: ReplyData }>>,
  setReposts: React.Dispatch<React.SetStateAction<{ [eventId: string]: RepostData }>>,
  setViews: React.Dispatch<React.SetStateAction<{ [eventId: string]: ViewCountData }>>,
  setProfiles: React.Dispatch<React.SetStateAction<ProfileCache>>,
  setWikidataMap: React.Dispatch<React.SetStateAction<Record<string, string>>>
): Promise<void> {
  if (events.length === 0) return

  const eventIds = events.map((e) => e.id)
  const authorPubkeys = [...new Set(events.map((e) => e.pubkey))]
  const contents = events.map((e) => e.content)
  const { superMentionPaths } = extractFromContents(contents)

  try {
    const { metadata, profiles, superMentions } = await fetchEventsEnrich(
      eventIds,
      authorPubkeys,
      viewerPubkey,
      superMentionPaths
    )

    // メタデータを各stateに展開
    const reactionMap: { [eventId: string]: ReactionData } = {}
    const replyMap: { [eventId: string]: ReplyData } = {}
    const repostMap: { [eventId: string]: RepostData } = {}
    const viewMap: { [eventId: string]: ViewCountData } = {}

    for (const eventId of eventIds) {
      const data = metadata[eventId]
      if (data) {
        reactionMap[eventId] = data.reactions
        replyMap[eventId] = data.replies
        repostMap[eventId] = data.reposts
        viewMap[eventId] = data.views
      } else {
        // デフォルト値で初期化
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

    // プロフィールをマージ
    setProfiles((prev) => {
      const newProfiles = { ...prev }
      for (const [pk, profile] of Object.entries(profiles)) {
        if (newProfiles[pk] === undefined) {
          newProfiles[pk] = profile || null
        }
      }
      return newProfiles
    })

    // WikidataMapをマージ
    if (Object.keys(superMentions).length > 0) {
      setWikidataMap((prev) => ({ ...prev, ...superMentions }))
    }
  } catch (error) {
    console.error('Failed to load enrich data:', error)
    // エラー時は空の値で初期化
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

// プロフィールをマージして更新（新しいpubkeysのみfetch）
export async function mergeProfiles(
  pubkeys: string[],
  currentProfiles: ProfileCache,
  setProfiles: React.Dispatch<React.SetStateAction<ProfileCache>>
): Promise<void> {
  const missingPubkeys = pubkeys.filter((pk) => currentProfiles[pk] === undefined)
  if (missingPubkeys.length === 0) return

  try {
    // fetchEventsEnrichを使ってプロフィールのみ取得（eventIds空でOK）
    const { profiles } = await fetchEventsEnrich([], missingPubkeys, undefined, [])
    setProfiles((prev) => {
      const newProfiles = { ...prev }
      for (const pk of missingPubkeys) {
        newProfiles[pk] = profiles[pk] || null
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

// OGPデータ一括読み込み
export async function loadOgpForEvents(
  events: Event[],
  setOgpMap: React.Dispatch<React.SetStateAction<Record<string, OgpData>>>
): Promise<void> {
  if (events.length === 0) return

  const contents = events.map((e) => e.content)
  const { ogpUrls } = extractFromContents(contents)

  if (ogpUrls.length === 0) return

  try {
    const ogpData = await fetchOgpBatch(ogpUrls)
    if (Object.keys(ogpData).length > 0) {
      setOgpMap((prev) => ({ ...prev, ...ogpData }))
    }
  } catch (error) {
    console.error('Failed to load OGP data:', error)
  }
}
