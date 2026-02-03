import geohash from 'ngeohash'

/**
 * SNS共有用のテキスト変換
 * - スーパーメンション @@xxx → #xxx
 * - 位置情報 → OSM URL
 */

// スーパーメンションをハッシュタグに変換
// @@対象 → #対象
// @@対象/派生 → #対象_派生
function convertSuperMentionsToHashtags(content: string): string {
  // @@で始まり、空白または行末まで続くパターン
  return content.replace(/@@([^\s]+)/g, (_, mention) => {
    // スラッシュをアンダースコアに変換
    const hashtag = mention.replace(/\//g, '_')
    return `#${hashtag}`
  })
}

// geohash から OSM URL を生成
function geohashToOsmUrl(hash: string): string | null {
  try {
    const { latitude, longitude } = geohash.decode(hash)
    return `https://www.openstreetmap.org/?mlat=${latitude.toFixed(6)}&mlon=${longitude.toFixed(6)}&zoom=17`
  } catch {
    return null
  }
}

// tags から位置情報を抽出
function extractLocationsFromTags(tags: string[][]): { geohash: string; name?: string }[] {
  const locations: { geohash: string; name?: string }[] = []
  for (const tag of tags) {
    if (tag[0] === 'g' && tag[1]) {
      // 最も詳細な geohash のみを使用（長いものを優先）
      const existing = locations.find((l) => tag[1].startsWith(l.geohash) || l.geohash.startsWith(tag[1]))
      if (existing) {
        if (tag[1].length > existing.geohash.length) {
          existing.geohash = tag[1]
          if (tag[2]) existing.name = tag[2]
        }
      } else {
        locations.push({ geohash: tag[1], name: tag[2] })
      }
    }
  }
  return locations
}

export interface SnsShareOptions {
  content: string
  tags: string[][]
  url: string
  /** 分割パート番号 (1/5 形式) */
  partInfo?: { current: number; total: number }
  /** 最初のパートか最後のパートか（分割時のURL挿入位置判定用） */
  includeUrl?: boolean
}

export interface TransformedContent {
  text: string
  /** 文字数 */
  length: number
}

/**
 * SNS共有用にコンテンツを変換
 */
export function transformContentForSns(options: SnsShareOptions): TransformedContent {
  const { content, tags, url, partInfo, includeUrl = true } = options

  // 1. スーパーメンションをハッシュタグに変換
  let text = convertSuperMentionsToHashtags(content)

  // 2. パート情報を追加
  if (partInfo) {
    text = `(${partInfo.current}/${partInfo.total})\n${text}`
  }

  // 3. 位置情報を追加
  const locations = extractLocationsFromTags(tags)
  if (locations.length > 0) {
    const locationTexts = locations
      .map((loc) => {
        const osmUrl = geohashToOsmUrl(loc.geohash)
        if (loc.name && osmUrl) {
          return `📍 ${loc.name}\n${osmUrl}`
        } else if (osmUrl) {
          return `📍 ${osmUrl}`
        }
        return null
      })
      .filter(Boolean)

    if (locationTexts.length > 0) {
      text = text + '\n\n' + locationTexts.join('\n')
    }
  }

  // 4. MY PACE URL を追加
  if (includeUrl) {
    text = text + '\n\n' + url
  }

  return {
    text,
    length: text.length,
  }
}

/**
 * X (Twitter) の文字数制限
 */
export const X_CHAR_LIMIT = 280

/**
 * Bluesky の文字数制限
 */
export const BLUESKY_CHAR_LIMIT = 300

/**
 * Threads の文字数制限
 */
export const THREADS_CHAR_LIMIT = 500

/**
 * SNSの文字数制限を取得
 */
export function getCharLimit(sns: 'x' | 'bluesky' | 'threads'): number {
  switch (sns) {
    case 'x':
      return X_CHAR_LIMIT
    case 'bluesky':
      return BLUESKY_CHAR_LIMIT
    case 'threads':
      return THREADS_CHAR_LIMIT
  }
}

/**
 * 長文を分割
 * 優先順位: 空行 → 単一改行 → 句読点 → 強制分割
 */
export function splitContentForSns(content: string, tags: string[][], url: string, charLimit: number): string[] {
  // URL と位置情報の追加分を計算
  const baseOverhead = transformContentForSns({
    content: '',
    tags,
    url,
    includeUrl: true,
  }).length

  // パート番号のオーバーヘッド "(99/99)\n" = 9文字程度
  const partOverhead = 10

  // 実際に使える文字数
  const effectiveLimit = charLimit - baseOverhead - partOverhead

  // 分割が不要な場合
  const fullTransformed = transformContentForSns({ content, tags, url })
  if (fullTransformed.length <= charLimit) {
    return [content]
  }

  // 分割を試みる
  const parts: string[] = []
  let remaining = content

  while (remaining.length > 0) {
    if (remaining.length <= effectiveLimit) {
      parts.push(remaining)
      break
    }

    // 区切り位置を探す
    const cutPoint = findBestCutPoint(remaining, effectiveLimit)
    parts.push(remaining.slice(0, cutPoint).trim())
    remaining = remaining.slice(cutPoint).trim()
  }

  return parts
}

/**
 * 最適な区切り位置を探す
 * 優先順位: 空行 → 単一改行 → 句読点 → 強制分割
 */
function findBestCutPoint(text: string, maxLength: number): number {
  const searchRange = text.slice(0, maxLength)

  // 1. 空行で区切る
  const doubleNewline = searchRange.lastIndexOf('\n\n')
  if (doubleNewline > maxLength * 0.3) {
    return doubleNewline + 2
  }

  // 2. 単一改行で区切る
  const singleNewline = searchRange.lastIndexOf('\n')
  if (singleNewline > maxLength * 0.3) {
    return singleNewline + 1
  }

  // 3. 句読点で区切る（。！？.!?）
  const punctuationMatch = searchRange.match(/.*[。！？.!?]/s)
  if (punctuationMatch && punctuationMatch[0].length > maxLength * 0.3) {
    return punctuationMatch[0].length
  }

  // 4. 強制分割（最終手段）
  return maxLength
}

/**
 * 分割されたパーツを最終的なテキストに変換
 */
export function formatSplitParts(parts: string[], tags: string[][], url: string): TransformedContent[] {
  const total = parts.length

  return parts.map((part, index) => {
    const isLast = index === total - 1
    const partInfo = total > 1 ? { current: index + 1, total } : undefined

    // 位置情報は最初のパートにのみ
    const partTags = index === 0 ? tags : []

    return transformContentForSns({
      content: part,
      tags: partTags,
      url,
      partInfo,
      includeUrl: isLast, // URLは最後のパートにのみ
    })
  })
}

/**
 * SNS Intent URL を生成
 */
export function getSnsIntentUrl(sns: 'x' | 'bluesky' | 'threads', text: string): string {
  const encoded = encodeURIComponent(text)
  switch (sns) {
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encoded}`
    case 'bluesky':
      return `https://bsky.app/intent/compose?text=${encoded}`
    case 'threads':
      return `https://www.threads.net/intent/post?text=${encoded}`
  }
}
