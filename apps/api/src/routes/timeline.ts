import { Hono } from 'hono'
import type { Filter } from 'nostr-tools'
import type { Bindings } from '../types'
import { MYPACE_TAG, RELAYS, KIND_NOTE, KIND_LONG_FORM, KIND_SINOV_NPC } from '../constants'
import { getCachedEvents, cacheEvents } from '../services/cache'
import { filterByLanguage } from '../filters/language'
import {
  filterBySmartFilters,
  filterByNPC,
  filterByMuteList,
  filterByNgWords,
  filterByNgTags,
} from '../filters/smart-filter'
import { SimplePool } from 'nostr-tools/pool'

const timeline = new Hono<{ Bindings: Bindings }>()

// GET /api/timeline - タイムライン取得
timeline.get('/', async (c) => {
  const db = c.env.DB
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
  // NG words: comma-separated words
  const ngParam = c.req.query('ng') || ''
  const ngWords = ngParam ? ngParam.split(',').filter(Boolean) : []
  // NG tags: comma-separated tags
  const ngTagsParam = c.req.query('ngtags') || ''
  const ngTags = ngTagsParam ? ngTagsParam.split(',').filter(Boolean) : []
  // Parse kinds parameter
  // Kind 42000 (Sinov NPC) is only included when mypace filter is active
  const kindsParam = c.req.query('kinds')
  const defaultKinds = showAll ? [KIND_NOTE, KIND_LONG_FORM] : [KIND_NOTE, KIND_LONG_FORM, KIND_SINOV_NPC]
  const kinds = kindsParam
    ? kindsParam
        .split(',')
        .map((k) => parseInt(k, 10))
        .filter((k) => !isNaN(k))
    : defaultKinds

  // まずキャッシュから取得（TTL内のもののみ）
  try {
    const cached = await getCachedEvents(db, {
      kinds,
      since,
      until,
      limit: limit * 2, // フィルタリング後に足りなくならないよう多めに取得
    })

    if (cached.length > 0) {
      let events = cached

      if (!showAll) {
        events = events.filter((e) => e.tags.some((t: string[]) => t[0] === 't' && t[1] === MYPACE_TAG))
      }

      // スマートフィルタ適用
      events = filterBySmartFilters(events, hideAds, hideNSFW)
      events = filterByNPC(events, hideNPC)
      events = filterByMuteList(events, mutedPubkeys)
      events = filterByNgWords(events, ngWords)
      events = filterByNgTags(events, ngTags)

      if (langFilter) {
        events = filterByLanguage(events, langFilter)
      }

      if (events.length >= limit) {
        return c.json({ events: events.slice(0, limit), source: 'cache' })
      }
    }
  } catch (e) {
    console.error('Cache read error:', e)
  }

  // キャッシュにない/不十分な場合はリレーから取得
  const pool = new SimplePool()

  try {
    const filter: Filter = {
      kinds,
      limit,
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

    let events = await pool.querySync(RELAYS, filter)
    events.sort((a, b) => b.created_at - a.created_at)

    // スマートフィルタ適用
    events = filterBySmartFilters(events, hideAds, hideNSFW)
    events = filterByNPC(events, hideNPC)
    events = filterByMuteList(events, mutedPubkeys)
    events = filterByNgWords(events, ngWords)
    events = filterByNgTags(events, ngTags)

    // 言語フィルタ（ユーザーの主要言語も考慮）
    if (langFilter) {
      events = filterByLanguage(events, langFilter)
    }

    // キャッシュに保存（フィルタ前のデータを保存すべきだが、一旦フィルタ後を保存）
    await cacheEvents(db, events)

    return c.json({ events, source: 'relay' })
  } catch (e) {
    console.error('Relay fetch error:', e)
    return c.json({ events: [], error: 'Failed to fetch from relay' }, 500)
  } finally {
    pool.close(RELAYS)
  }
})

export default timeline
