import { AD_TAGS, AD_KEYWORDS, NSFW_TAGS, NSFW_KEYWORDS } from '../constants'

// URLの数をカウント
function countUrls(text: string): number {
  const urlPattern = /https?:\/\/[^\s]+/g
  const matches = text.match(urlPattern)
  return matches ? matches.length : 0
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
