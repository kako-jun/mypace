import { Hono } from 'hono'
import type { Filter } from 'nostr-tools'
import type { Bindings } from '../types'
import { MYPACE_TAG, KIND_NOTE, KIND_LONG_FORM, KIND_SINOV_NPC, CACHE_CLEANUP_PROBABILITY } from '../constants'
import { getCachedEvents, cacheEvents, cleanupAllCaches } from '../services/cache'
import { filterByLanguage } from '../filters/language'
import {
  filterBySmartFilters,
  filterByNPC,
  filterByMuteList,
  filterByNgWords,
  filterByNgTags,
  filterByQuery,
  filterByOkTags,
} from '../filters/smart-filter'
import { SimplePool } from 'nostr-tools/pool'

const timeline = new Hono<{ Bindings: Bindings }>()

// GET /api/timeline - タイムライン取得
// 503エラー対策: タイムラインは常にキャッシュのみ（リレー接続しない）
// 他のエンドポイント(enrich等)はリレーを使用するため、表示されたイベントの詳細は取得可能
timeline.get('/', async (c) => {
  const db = c.env.DB
  const disableCache = c.env.DISABLE_CACHE === '1'
  // タイムラインは常にキャッシュのみモード（RELAY_COUNTを無視）
  const fetchMultiplier = c.env.FETCH_MULTIPLIER !== undefined ? parseInt(c.env.FETCH_MULTIPLIER, 10) : 1
  const RELAYS: string[] = [] // 常に空配列 = キャッシュのみ
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100)
  const since = Number(c.req.query('since')) || 0
  const until = Number(c.req.query('until')) || 0
  const showAll = c.req.query('all') === '1'
  const langFilter = c.req.query('lang') || ''
  // Smart filters: default to hide (hideAds=1, hideNSFW=1)
  const hideAds = c.req.query('hideAds') !== '0'
  const hideNSFW = c.req.query('hideNSFW') !== '0'
  // NPC filter: default OFF, hideNPC=1 to hide
  const hideNPC = c.req.query('hideNPC') === '1'
  // Mute list: comma-separated pubkeys
  const muteParam = c.req.query('mute') || ''
  const mutedPubkeys = muteParam ? muteParam.split(',').filter(Boolean) : []
  // NG words: + separated words
  const ngParam = c.req.query('ng') || ''
  const ngWords = ngParam ? ngParam.split('+').map(decodeURIComponent).filter(Boolean) : []
  // NG tags: + separated tags
  const ngTagsParam = c.req.query('ngtags') || ''
  const ngTags = ngTagsParam ? ngTagsParam.split('+').map(decodeURIComponent).filter(Boolean) : []
  // Search query: + separated keywords (AND search, Google-style)
  const queryParam = c.req.query('q') || ''
  const queries = queryParam ? queryParam.split('+').map(decodeURIComponent).filter(Boolean) : []
  // OK tags: + separated tags (AND search)
  const okTagsParam = c.req.query('tags') || ''
  const okTags = okTagsParam ? okTagsParam.split('+').map(decodeURIComponent).filter(Boolean) : []
  // Parse kinds parameter
  // Kind 42000 (Sinov NPC) is only included when mypace filter is active
  const kindsParam = c.req.query('kinds')
  const defaultKinds = showAll ? [KIND_NOTE, KIND_LONG_FORM] : [KIND_NOTE, KIND_LONG_FORM, KIND_SINOV_NPC]
  // If kinds param is explicitly set (even if empty), use it; otherwise use defaults
  const kinds =
    kindsParam !== undefined && kindsParam !== null
      ? kindsParam
          .split(',')
          .map((k) => parseInt(k, 10))
          .filter((k) => !isNaN(k))
      : defaultKinds

  // If kinds is empty, return empty result (SNS and Blog both OFF)
  if (kinds.length === 0) {
    return c.json({ events: [], source: 'empty-filter' })
  }

  // サーバーサイドフィルタ（hideAds, hideNSFW等）で減る分を考慮して多めに取得
  // fetchMultiplierは環境変数で設定（デフォルト1）

  // まずキャッシュから取得（TTL内のもののみ）
  // DISABLE_CACHE=1 の場合はスキップ
  if (!disableCache) {
    try {
      const cached = await getCachedEvents(db, {
        kinds,
        since,
        until,
        limit: limit * fetchMultiplier, // フィルタリング後に足りなくならないよう多めに取得
        mypaceOnly: !showAll, // mypaceフィルタONの場合はhas_mypace_tag=1でフィルタ
      })

      if (cached.length > 0) {
        // フィルタ前の最古時刻を記録
        const searchedUntil = Math.min(...cached.map((e) => e.created_at))

        let events = cached

        // フィルタ適用（除外率の高い順に実行）
        events = filterByMuteList(events, mutedPubkeys)
        events = filterBySmartFilters(events, hideAds, hideNSFW)
        events = filterByNPC(events, hideNPC)
        events = filterByNgWords(events, ngWords)
        events = filterByNgTags(events, ngTags)
        // 公開フィルタ（OKワード、OKタグ）
        events = filterByQuery(events, queries)
        events = filterByOkTags(events, okTags)

        if (langFilter) {
          events = filterByLanguage(events, langFilter)
        }

        // キャッシュのみモード(RELAY_COUNT=0)または十分な件数がある場合はキャッシュから返す
        if (events.length >= limit || RELAYS.length === 0) {
          // レスポンスサイズ削減: contentを切り詰め
          const MAX_CONTENT_LENGTH = 5000
          const trimmedEvents = events.slice(0, limit).map((e) => ({
            ...e,
            content: e.content.length > MAX_CONTENT_LENGTH ? e.content.slice(0, MAX_CONTENT_LENGTH) + '...' : e.content,
          }))
          const source = RELAYS.length === 0 ? 'cache-only' : 'cache'
          return c.json({ events: trimmedEvents, source, searchedUntil })
        }
      }
    } catch (e) {
      console.error('Cache read error:', e)
    }
  }

  // キャッシュにない/不十分な場合はリレーから取得
  // RELAY_COUNT=0の場合はリレー接続をスキップ
  if (RELAYS.length === 0) {
    return c.json({ events: [], source: 'cache-only', searchedUntil: null })
  }

  const pool = new SimplePool()

  try {
    const filter: Filter = {
      kinds,
      limit: limit * fetchMultiplier,
    }
    if (!showAll) {
      filter['#t'] = [MYPACE_TAG]
    }
    if (since > 0) {
      filter.since = since
    }
    if (until > 0) {
      filter.until = until
    }

    const rawEvents = await pool.querySync(RELAYS, filter)
    rawEvents.sort((a, b) => b.created_at - a.created_at)

    // フィルタ前の最古時刻を記録（次回のuntilに使用）
    const searchedUntil = rawEvents.length > 0 ? Math.min(...rawEvents.map((e) => e.created_at)) : null

    let events = rawEvents
    // フィルタ適用（除外率の高い順に実行）
    events = filterByMuteList(events, mutedPubkeys)
    events = filterBySmartFilters(events, hideAds, hideNSFW)
    events = filterByNPC(events, hideNPC)
    events = filterByNgWords(events, ngWords)
    events = filterByNgTags(events, ngTags)
    // 公開フィルタ（OKワード、OKタグ）
    events = filterByQuery(events, queries)
    events = filterByOkTags(events, okTags)

    // 言語フィルタ（ユーザーの主要言語も考慮）
    if (langFilter) {
      events = filterByLanguage(events, langFilter)
    }

    // キャッシュに保存（DISABLE_CACHE=1 の場合はスキップ）
    if (!disableCache && c.executionCtx?.waitUntil && rawEvents.length > 0) {
      // リソース制限対策: 最新50件のみキャッシュ
      const eventsToCache = rawEvents.slice(0, 50)
      c.executionCtx.waitUntil(cacheEvents(db, eventsToCache))
      // 0.5%の確率で古いキャッシュをクリーンアップ
      if (Math.random() < CACHE_CLEANUP_PROBABILITY / 2) {
        c.executionCtx.waitUntil(cleanupAllCaches(db))
      }
    }

    // レスポンスサイズ削減: contentを切り詰め（タイムラインでは省略表示なので問題なし）
    const MAX_CONTENT_LENGTH = 5000
    const trimmedEvents = events.map((e) => ({
      ...e,
      content: e.content.length > MAX_CONTENT_LENGTH ? e.content.slice(0, MAX_CONTENT_LENGTH) + '...' : e.content,
    }))

    return c.json({ events: trimmedEvents, source: 'relay', searchedUntil })
  } catch (e) {
    console.error('Relay fetch error:', e)
    return c.json({ events: [], error: 'Failed to fetch from relay' }, 500)
  } finally {
    pool.close(RELAYS)
  }
})

export default timeline
