import { useState, useEffect, useCallback } from 'react'
import {
  fetchEventById,
  fetchEventsByIds,
  fetchProfiles,
  fetchEventMetadata,
  parseRepostEvent,
} from '../../lib/nostr/relay'
import { KIND_REPOST } from '../../lib/nostr/constants'
import { fetchViewsAndSuperMentions, recordImpressions, extractNouns, fetchWordrotInventory } from '../../lib/api/api'
import { getCurrentPubkey, EMPTY_STELLA_COUNTS } from '../../lib/nostr/events'
import { getCachedPost, getCachedProfile, getCachedPostMetadata, getErrorMessage } from '../../lib/utils'
import { extractSuperMentionPaths } from '../../lib/utils/content'
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
  wikidataMap: Record<string, string>
  replyProfiles: { [pubkey: string]: LoadableProfile }
  parentEvent: Event | null
  parentProfile: LoadableProfile
  setReactions: React.Dispatch<React.SetStateAction<ReactionData>>
  setReposts: React.Dispatch<React.SetStateAction<{ count: number; myRepost: boolean }>>
  // Wordrot data
  wordrotWords: string[]
  wordrotCollected: Set<string>
  wordrotImages: Record<string, string | null>
}

const initialReactions: ReactionData = {
  myReaction: false,
  myStella: { ...EMPTY_STELLA_COUNTS },
  myReactionId: null,
  reactors: [],
}

// Wordrot取得（extractNouns + fetchWordrotInventory）- fire-and-forget用ヘルパー
async function loadWordrotData(
  eventId: string,
  content: string,
  pubkey: string,
  setWordrotWords: React.Dispatch<React.SetStateAction<string[]>>,
  setWordrotCollected: React.Dispatch<React.SetStateAction<Set<string>>>,
  setWordrotImages: React.Dispatch<React.SetStateAction<Record<string, string | null>>>
): Promise<void> {
  const extractionResult = await extractNouns(eventId, content)
  if (extractionResult.words.length === 0) return

  setWordrotWords(extractionResult.words)
  const inventory = await fetchWordrotInventory(pubkey)
  const collected = new Set<string>(inventory.words.map((w) => w.word.text.toLowerCase()))
  setWordrotCollected(collected)

  const images: Record<string, string | null> = {}
  for (const item of inventory.words) {
    if (item.word.image_url) {
      images[item.word.text] = item.word.image_url
    }
  }
  setWordrotImages(images)
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
  const [wikidataMap, setWikidataMap] = useState<Record<string, string>>({})
  const [replyProfiles, setReplyProfiles] = useState<{ [pubkey: string]: LoadableProfile }>({})
  const [parentEvent, setParentEvent] = useState<Event | null>(null)
  const [parentProfile, setParentProfile] = useState<LoadableProfile>(undefined)

  // Wordrot state
  const [wordrotWords, setWordrotWords] = useState<string[]>([])
  const [wordrotCollected, setWordrotCollected] = useState<Set<string>>(new Set())
  const [wordrotImages, setWordrotImages] = useState<Record<string, string | null>>({})

  const loadPost = useCallback(async () => {
    setError('')
    setParentEvent(null)
    setParentProfile(undefined)
    try {
      const pubkey = await getCurrentPubkey()
      setMyPubkey(pubkey)

      let eventData: Event | null = getCachedPost(eventId)
      const cachedMetadata = getCachedPostMetadata(eventId)

      // === イベント取得 ===
      if (eventData) {
        setEvent(eventData)
        setLoading(false)
        // キャッシュ済みプロフィールは即座に設定（後でバッチ取得で更新される可能性あり）
        const cachedProfileData = getCachedProfile(eventData.pubkey)
        if (cachedProfileData) {
          setProfile(cachedProfileData)
        }
        // キャッシュ済みメタデータを即座に設定
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
      }

      if (!eventData) return

      // === キャッシュ済みメタデータパス（タイムラインからの遷移） ===
      if (cachedMetadata) {
        // スーパーメンション: キャッシュ済みなら使用、なければAPI取得
        if (cachedMetadata.superMentions && Object.keys(cachedMetadata.superMentions).length > 0) {
          setWikidataMap(cachedMetadata.superMentions)
        } else {
          const superMentionPaths = extractSuperMentionPaths(eventData.content)
          if (superMentionPaths.length > 0) {
            fetchViewsAndSuperMentions([], superMentionPaths)
              .then(({ superMentions }) => setWikidataMap(superMentions))
              .catch(() => {})
          }
        }

        // インプレッション記録（fire-and-forget）
        if (hasMypaceTag(eventData) && pubkey) {
          recordImpressions([{ eventId, authorPubkey: eventData.pubkey }], 'detail', pubkey).catch(() => {})
        }

        // リプライタグから親イベントIDを取得
        const replyTag = eventData.tags.find((tag) => tag[0] === 'e' && (tag[3] === 'reply' || tag[3] === 'root'))

        // 並列実行: Wordrot(API) + 親イベント取得(リレー)
        const [, parentResult] = await Promise.all([
          // Wordrot（API呼び出し2回: extractNouns + fetchWordrotInventory）
          pubkey && eventData.content
            ? loadWordrotData(
                eventId,
                eventData.content,
                pubkey,
                setWordrotWords,
                setWordrotCollected,
                setWordrotImages
              ).catch((err) => console.error('[usePostViewData] Failed to fetch Wordrot data:', err))
            : Promise.resolve(),
          // 親イベント取得（リレー1回）
          replyTag
            ? fetchEventsByIds([replyTag[1]])
                .then((events) => (events[replyTag[1]] as Event) || null)
                .catch(() => null)
            : Promise.resolve(null),
        ])

        if (parentResult) {
          setParentEvent(parentResult)
        }

        // 全pubkeyを収集してプロフィールを1回でバッチ取得（リレー1回）
        const replyPubkeys = cachedMetadata.replies.replies.map((r) => r.pubkey)
        const reactorPubkeys = cachedMetadata.reactions.reactors.map((r) => r.pubkey)
        const originalPubkey = eventData.kind === KIND_REPOST ? parseRepostEvent(eventData)?.pubkey : null
        const allPubkeys = [
          ...new Set([
            // 投稿者プロフィールがキャッシュに無い場合のみ含める
            ...(getCachedProfile(eventData.pubkey) ? [] : [eventData.pubkey]),
            ...replyPubkeys,
            ...reactorPubkeys,
            ...(originalPubkey ? [originalPubkey] : []),
            ...(parentResult ? [parentResult.pubkey] : []),
          ]),
        ]

        if (allPubkeys.length > 0) {
          try {
            const fetchedProfiles = await fetchProfiles(allPubkeys)
            // 投稿者プロフィール設定（キャッシュに無かった場合）
            if (!getCachedProfile(eventData.pubkey) && fetchedProfiles[eventData.pubkey]) {
              setProfile(fetchedProfiles[eventData.pubkey] as Profile)
            }
            // リプライ/リアクター/元投稿者プロフィール設定
            const rpProfiles: { [pubkey: string]: LoadableProfile } = {}
            for (const pk of allPubkeys) {
              rpProfiles[pk] = fetchedProfiles[pk] ?? null
            }
            setReplyProfiles(rpProfiles)
            // 親投稿者プロフィール設定
            if (parentResult && fetchedProfiles[parentResult.pubkey]) {
              setParentProfile(fetchedProfiles[parentResult.pubkey] as Profile)
            }
          } catch {}
        }
        return
      }

      // === 非キャッシュパス（直接URLアクセス等） ===
      const superMentionPaths = extractSuperMentionPaths(eventData.content)
      const replyTag = eventData.tags.find((tag) => tag[0] === 'e' && (tag[3] === 'reply' || tag[3] === 'root'))

      // 並列実行: メタデータ(リレー) + ビュー&スーパーメンション(API) + 親イベント(リレー) + Wordrot(API)
      const [metadata, { views: viewsData, superMentions }, parentResult] = await Promise.all([
        fetchEventMetadata([eventId], pubkey || undefined),
        fetchViewsAndSuperMentions([eventId], superMentionPaths),
        replyTag
          ? fetchEventsByIds([replyTag[1]])
              .then((events) => (events[replyTag[1]] as Event) || null)
              .catch(() => null)
          : Promise.resolve(null),
      ])

      // Wordrotはメタデータ取得と並列で開始（fire-and-forget）
      if (pubkey && eventData.content) {
        loadWordrotData(
          eventId,
          eventData.content,
          pubkey,
          setWordrotWords,
          setWordrotCollected,
          setWordrotImages
        ).catch((err) => console.error('[usePostViewData] Failed to fetch Wordrot data:', err))
      }

      const eventMetadata = metadata[eventId]
      if (eventMetadata) {
        setReactions(eventMetadata.reactions)
        setReplies(eventMetadata.replies)
        setReposts(eventMetadata.reposts)
      }
      setViews(viewsData[eventId] || { impression: 0, detail: 0 })
      setWikidataMap(superMentions)

      // インプレッション記録（fire-and-forget）
      if (hasMypaceTag(eventData) && pubkey) {
        recordImpressions([{ eventId, authorPubkey: eventData.pubkey }], 'detail', pubkey).catch(() => {})
      }

      if (parentResult) {
        setParentEvent(parentResult)
      }

      // 全pubkeyを収集して1回でバッチ取得（リレー1回）
      const replyPubkeys = eventMetadata?.replies.replies.map((r) => r.pubkey) || []
      const reactorPubkeys = eventMetadata?.reactions.reactors.map((r) => r.pubkey) || []
      const originalPubkey = eventData.kind === KIND_REPOST ? parseRepostEvent(eventData)?.pubkey : null
      const allPubkeys = [
        ...new Set([
          eventData.pubkey,
          ...replyPubkeys,
          ...reactorPubkeys,
          ...(originalPubkey ? [originalPubkey] : []),
          ...(parentResult ? [parentResult.pubkey] : []),
        ]),
      ]

      if (allPubkeys.length > 0) {
        try {
          const fetchedProfiles = await fetchProfiles(allPubkeys)
          // 投稿者プロフィール設定
          if (fetchedProfiles[eventData.pubkey]) {
            setProfile(fetchedProfiles[eventData.pubkey] as Profile)
          }
          // リプライ/リアクター/元投稿者プロフィール設定
          const rpProfiles: { [pubkey: string]: LoadableProfile } = {}
          for (const pk of allPubkeys) {
            rpProfiles[pk] = fetchedProfiles[pk] ?? null
          }
          setReplyProfiles(rpProfiles)
          // 親投稿者プロフィール設定
          if (parentResult && fetchedProfiles[parentResult.pubkey]) {
            setParentProfile(fetchedProfiles[parentResult.pubkey] as Profile)
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
    wikidataMap,
    replyProfiles,
    parentEvent,
    parentProfile,
    setReactions,
    setReposts,
    wordrotWords,
    wordrotCollected,
    wordrotImages,
  }
}
