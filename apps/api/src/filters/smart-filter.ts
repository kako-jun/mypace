import { AD_TAGS, AD_KEYWORDS, NSFW_TAGS, NSFW_KEYWORDS, KIND_SINOV_NPC } from '../constants'

// URLの数をカウント
function countUrls(text: string): number {
  const urlPattern = /https?:\/\/[^\s]+/g
  const matches = text.match(urlPattern)
  return matches ? matches.length : 0
}

// NPCフィルタ: kind 42000を除外
export function filterByNPC<T extends { kind: number }>(events: T[], hideNPC: boolean): T[] {
  if (!hideNPC) return events
  return events.filter((e) => e.kind !== KIND_SINOV_NPC)
}

// ミュートリストフィルタ: 指定pubkeyを除外
export function filterByMuteList<T extends { pubkey: string }>(events: T[], mutedPubkeys: string[]): T[] {
  if (mutedPubkeys.length === 0) return events
  return events.filter((e) => !mutedPubkeys.includes(e.pubkey))
}

// NGワードフィルタ: 本文にNGワードを含む投稿を除外
export function filterByNgWords<T extends { content: string }>(events: T[], ngWords: string[]): T[] {
  if (ngWords.length === 0) return events
  const ngWordsLower = ngWords.map((w) => w.toLowerCase())
  return events.filter((e) => {
    const contentLower = e.content.toLowerCase()
    return !ngWordsLower.some((ngWord) => contentLower.includes(ngWord))
  })
}

// NGタグフィルタ: 指定タグを含む投稿を除外
export function filterByNgTags<T extends { tags: string[][] }>(events: T[], ngTags: string[]): T[] {
  if (ngTags.length === 0) return events
  const ngTagsLower = ngTags.map((t) => t.toLowerCase())
  return events.filter((e) => {
    const eventTags = e.tags
      .filter((t) => t[0] === 't')
      .map((t) => t[1]?.toLowerCase())
      .filter(Boolean)
    return !eventTags.some((tag) => ngTagsLower.includes(tag))
  })
}

// スマートフィルタ: 広告/NSFWコンテンツをフィルタ
export function filterBySmartFilters<T extends { content: string; tags: string[][] }>(
  events: T[],
  hideAds: boolean,
  hideNSFW: boolean
): T[] {
  if (!hideAds && !hideNSFW) return events

  return events.filter((e) => {
    const contentLower = e.content.toLowerCase()
    const eventTags = e.tags
      .filter((t) => t[0] === 't')
      .map((t) => t[1]?.toLowerCase())
      .filter(Boolean)

    // 広告フィルタ
    if (hideAds) {
      // タグチェック
      if (eventTags.some((tag) => AD_TAGS.includes(tag))) {
        return false
      }
      // キーワードチェック（本文）
      if (AD_KEYWORDS.some((kw) => contentLower.includes(kw.toLowerCase()))) {
        return false
      }
      // リンクが多すぎる（11個以上）はスパム判定
      if (countUrls(e.content) > 10) {
        return false
      }
    }

    // NSFWフィルタ
    if (hideNSFW) {
      // タグチェック
      if (eventTags.some((tag) => NSFW_TAGS.includes(tag))) {
        return false
      }
      // キーワードチェック（本文）
      if (NSFW_KEYWORDS.some((kw) => contentLower.includes(kw.toLowerCase()))) {
        return false
      }
    }

    return true
  })
}
