import { fetchOgpByUrls, recordImpressions } from '../../lib/api/api'
import { fetchEventsEnrich, fetchProfiles } from '../../lib/nostr/relay'
import { EMPTY_STELLA_COUNTS } from '../../lib/nostr/events'
import { hasMypaceTag } from '../../lib/nostr/tags'
import { extractFromContents } from '../../lib/utils/content'
import type { Event, ProfileCache, ReactionData, ReplyData, RepostData, ViewCountData, OgpData } from '../../types'

// イベントのエンリッチメント一括読み込み（metadata + profiles + super-mentions + views）
// currentProfiles: 既にキャッシュ済みのプロフィール（渡された場合、既知のpubkeyはリレークエリから除外）
export async function loadEnrichForEvents(
  events: Event[],
  viewerPubkey: string,
  setReactions: React.Dispatch<React.SetStateAction<{ [eventId: string]: ReactionData }>>,
  setReplies: React.Dispatch<React.SetStateAction<{ [eventId: string]: ReplyData }>>,
  setReposts: React.Dispatch<React.SetStateAction<{ [eventId: string]: RepostData }>>,
  setViews: React.Dispatch<React.SetStateAction<{ [eventId: string]: ViewCountData }>>,
  setProfiles: React.Dispatch<React.SetStateAction<ProfileCache>>,
  setWikidataMap: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  currentProfiles?: ProfileCache
): Promise<void> {
  if (events.length === 0) return

  const eventIds = events.map((e) => e.id)
  const authorPubkeys = [...new Set(events.map((e) => e.pubkey))]
  const contents = events.map((e) => e.content)
  const { superMentionPaths } = extractFromContents(contents)

  // キャッシュ済みのpubkeyを除外してリレークエリを節約
  const unknownPubkeys = currentProfiles
    ? authorPubkeys.filter((pk) => currentProfiles[pk] === undefined)
    : authorPubkeys

  try {
    // fetchEventsEnrich で一括取得（md計画通りの関数名）
    const { metadata, profiles, views, superMentions } = await fetchEventsEnrich(
      eventIds,
      unknownPubkeys,
      superMentionPaths,
      viewerPubkey
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
      } else {
        // デフォルト値で初期化
        reactionMap[eventId] = {
          myReaction: false,
          myStella: { ...EMPTY_STELLA_COUNTS },
          myReactionId: null,
          reactors: [],
        }
        replyMap[eventId] = { count: 0, replies: [] }
        repostMap[eventId] = { count: 0, myRepost: false }
      }
      // views from API
      viewMap[eventId] = views[eventId] || { impression: 0, detail: 0 }
    }

    // 既存データとマージ（上書きではなく追加）
    setReactions((prev) => ({ ...prev, ...reactionMap }))
    setReplies((prev) => ({ ...prev, ...replyMap }))
    setReposts((prev) => ({ ...prev, ...repostMap }))
    setViews((prev) => ({ ...prev, ...viewMap }))

    // プロフィールをマージ（取得結果が存在するpubkeyのみ設定）
    setProfiles((prev) => {
      const newProfiles = { ...prev }
      for (const pk of authorPubkeys) {
        if (pk in profiles) {
          // 取得結果がある場合のみ更新（Profile=見つかった、null=未設定）
          // 取得結果がない場合（undefined）はリレー障害の可能性があるため、undefinedのまま保持しリトライ可能にする
          if (newProfiles[pk] === undefined || profiles[pk] !== null) {
            newProfiles[pk] = profiles[pk]
          }
        }
      }
      return newProfiles
    })

    // WikidataMapをマージ
    if (Object.keys(superMentions).length > 0) {
      setWikidataMap((prev) => ({ ...prev, ...superMentions }))
    }

    // リアクター（ステラを押した人）のプロフィールも取得
    // 今回取得済み + キャッシュ済みの両方を除外
    const reactorPubkeys = Object.values(metadata)
      .flatMap((m) => m.reactions.reactors.map((r) => r.pubkey))
      .filter((pk) => profiles[pk] === undefined && (!currentProfiles || currentProfiles[pk] === undefined))
    const uniqueReactorPubkeys = [...new Set(reactorPubkeys)]

    if (uniqueReactorPubkeys.length > 0) {
      // fire-and-forget でリアクターのプロフィールを取得
      fetchProfiles(uniqueReactorPubkeys).then((reactorProfiles) => {
        setProfiles((prev) => {
          const newProfiles = { ...prev }
          for (const pk of uniqueReactorPubkeys) {
            if (newProfiles[pk] === undefined && pk in reactorProfiles) {
              newProfiles[pk] = reactorProfiles[pk]
            }
          }
          return newProfiles
        })
      })
    }
  } catch (error) {
    console.error('Failed to load enrich data:', error)
    // エラー時は空の値で初期化
    const reactionMap: { [eventId: string]: ReactionData } = {}
    const replyMap: { [eventId: string]: ReplyData } = {}
    const repostMap: { [eventId: string]: RepostData } = {}
    const viewMap: { [eventId: string]: ViewCountData } = {}

    for (const eventId of eventIds) {
      reactionMap[eventId] = {
        myReaction: false,
        myStella: { ...EMPTY_STELLA_COUNTS },
        myReactionId: null,
        reactors: [],
      }
      replyMap[eventId] = { count: 0, replies: [] }
      repostMap[eventId] = { count: 0, myRepost: false }
      viewMap[eventId] = { impression: 0, detail: 0 }
    }

    // 既存データとマージ（上書きではなく追加）
    setReactions((prev) => ({ ...prev, ...reactionMap }))
    setReplies((prev) => ({ ...prev, ...replyMap }))
    setReposts((prev) => ({ ...prev, ...repostMap }))
    setViews((prev) => ({ ...prev, ...viewMap }))

    // エラー時はプロフィールをundefinedのまま保持（次回リトライ可能にする）
    // 虹色ローディングアニメーションは継続するが、マイペースさん誤表示よりも適切
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
    // Nostrリレーから直接取得
    const profiles = await fetchProfiles(missingPubkeys)
    setProfiles((prev) => {
      const newProfiles = { ...prev }
      for (const pk of missingPubkeys) {
        // 取得結果がある場合のみ設定（キーが存在しない=リレー障害→リトライ対象）
        if (pk in profiles) {
          newProfiles[pk] = profiles[pk]
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
  recordImpressions(mypaceEvents, 'impression', viewerPubkey).catch(() => {})
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
    const ogpData = await fetchOgpByUrls(ogpUrls)
    if (Object.keys(ogpData).length > 0) {
      setOgpMap((prev) => ({ ...prev, ...ogpData }))
    }
  } catch (error) {
    console.error('Failed to load OGP data:', error)
  }
}
