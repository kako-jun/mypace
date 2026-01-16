import { Hono } from 'hono'
import type { Filter } from 'nostr-tools'
import type { Bindings } from '../types'
import { ALL_RELAYS, MYPACE_TAG, KIND_NOTE, KIND_LONG_FORM, KIND_SINOV_NPC } from '../constants'
import { SimplePool } from 'nostr-tools/pool'
import { filterByLanguage } from '../filters/language'
import {
  filterBySmartFilters,
  filterByNPC,
  filterByNgWords,
  filterByNgTags,
  filterByQuery,
  filterByOkTags,
} from '../filters/smart-filter'

const userEvents = new Hono<{ Bindings: Bindings }>()

// GET /api/user/:pubkey/events - ユーザーの投稿取得
userEvents.get('/:pubkey/events', async (c) => {
  // リレー設定: RELAY_COUNT=0でリレー接続をスキップ
  const relayCount = c.env.RELAY_COUNT !== undefined ? parseInt(c.env.RELAY_COUNT, 10) : ALL_RELAYS.length
  const fetchMultiplier = c.env.FETCH_MULTIPLIER !== undefined ? parseInt(c.env.FETCH_MULTIPLIER, 10) : 1
  const RELAYS = ALL_RELAYS.slice(0, Math.max(0, relayCount))

  const pubkey = c.req.param('pubkey')
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100)
  const since = Number(c.req.query('since')) || 0
  const until = Number(c.req.query('until')) || 0
  // Optional: show all posts (not just mypace tagged)
  const showAll = c.req.query('all') === '1'
  // Language filter
  const langFilter = c.req.query('lang') || ''
  // Smart filters: default to hide (hideAds=1, hideNSFW=1)
  const hideAds = c.req.query('hideAds') !== '0'
  const hideNSFW = c.req.query('hideNSFW') !== '0'
  // NPC filter: default OFF, hideNPC=1 to hide
  const hideNPC = c.req.query('hideNPC') === '1'
  // NG words: + separated words
  const ngParam = c.req.query('ng') || ''
  const ngWords = ngParam ? ngParam.split('+').map(decodeURIComponent).filter(Boolean) : []
  // NG tags: + separated tags
  const ngTagsParam = c.req.query('ngtags') || ''
  const ngTags = ngTagsParam ? ngTagsParam.split('+').map(decodeURIComponent).filter(Boolean) : []
  // Optional tags filter (+ separated)
  const tagsParam = c.req.query('tags') || ''
  const filterTags = tagsParam ? tagsParam.split('+').map(decodeURIComponent).filter(Boolean) : []
  // Optional text search query (+ separated for AND search, Google-style)
  const queryParam = c.req.query('q') || ''
  const queries = queryParam ? queryParam.split('+').map(decodeURIComponent).filter(Boolean) : []
  // Parse kinds parameter
  const kindsParam = c.req.query('kinds')
  const defaultKinds = showAll ? [KIND_NOTE, KIND_LONG_FORM] : [KIND_NOTE, KIND_LONG_FORM, KIND_SINOV_NPC]
  const kinds =
    kindsParam !== undefined && kindsParam !== null
      ? kindsParam
          .split(',')
          .map((k) => parseInt(k, 10))
          .filter((k) => !isNaN(k))
      : defaultKinds

  // If kinds is empty, return empty result (SNS and Blog both OFF)
  if (kinds.length === 0) {
    return c.json({ events: [] })
  }

  // サーバーサイドフィルタ（hideAds, hideNSFW等）で減る分を考慮して多めに取得
  // fetchMultiplierは環境変数で設定（デフォルト1）

  // RELAY_COUNT=0の場合はリレー接続をスキップ
  if (RELAYS.length === 0) {
    return c.json({ events: [], searchedUntil: null })
  }

  const pool = new SimplePool()

  try {
    const filter: Filter = {
      kinds,
      authors: [pubkey],
      limit: limit * fetchMultiplier,
    }

    // Build tag filter: mypace + optional additional tags (unless showAll)
    if (!showAll || filterTags.length > 0) {
      const tagFilter = showAll ? filterTags : [MYPACE_TAG, ...filterTags]
      if (tagFilter.length > 0) {
        filter['#t'] = tagFilter
      }
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
    events = filterBySmartFilters(events, hideAds, hideNSFW)
    events = filterByNPC(events, hideNPC)
    events = filterByNgWords(events, ngWords)
    events = filterByNgTags(events, ngTags)
    events = filterByQuery(events, queries)
    events = filterByOkTags(events, filterTags)

    if (langFilter) {
      events = filterByLanguage(events, langFilter)
    }

    // レスポンスサイズ削減: contentを切り詰め
    const MAX_CONTENT_LENGTH = 5000
    const trimmedEvents = events.slice(0, limit).map((e) => ({
      ...e,
      content: e.content.length > MAX_CONTENT_LENGTH ? e.content.slice(0, MAX_CONTENT_LENGTH) + '...' : e.content,
    }))
    return c.json({ events: trimmedEvents, searchedUntil })
  } finally {
    pool.close(RELAYS)
  }
})

export default userEvents
