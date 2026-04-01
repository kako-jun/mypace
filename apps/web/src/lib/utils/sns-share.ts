import geohash from 'ngeohash'

/**
 * SNS共有用のテキスト変換
 * - スーパーメンション @@xxx → #xxx
 * - Nostr t タグ → #hashtag（コンテンツに未含有のもの）
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

// tags から SNS に表示するハッシュタグを抽出
// すべての t タグをハッシュタグ化（コンテンツに既存のものは除外）
function extractHashtagsForSns(tags: string[][], content: string): string[] {
  const hashtags: string[] = []
  const contentLower = content.toLowerCase()

  for (const tag of tags) {
    if (tag[0] === 't' && tag[1]) {
      const tagValue = tag[1]
      const tagLower = tagValue.toLowerCase()
      // 既にコンテンツ内に #tag として存在する場合はスキップ
      if (contentLower.includes(`#${tagLower}`)) continue
      // 重複チェック
      if (!hashtags.some((h) => h.toLowerCase() === tagLower)) {
        hashtags.push(tagValue)
      }
    }
  }
  return hashtags
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

interface SnsShareOptions {
  content: string
  tags: string[][]
  url: string
  /** 分割パート番号 (1/5 形式) */
  partInfo?: { current: number; total: number }
  /** 最初のパートか最後のパートか（分割時のURL挿入位置判定用） */
  includeUrl?: boolean
}

interface TransformedContent {
  text: string
  /** 文字数 */
  length: number
}

/**
 * SNS共有用にコンテンツを変換
 */
function transformContentForSns(options: SnsShareOptions): TransformedContent {
  const { content, tags, url, partInfo, includeUrl = true } = options

  // 1. スーパーメンションをハッシュタグに変換
  let text = convertSuperMentionsToHashtags(content)

  // 2. パート情報を追加
  if (partInfo) {
    text = `(${partInfo.current}/${partInfo.total})\n${text}`
  }

  // 3. t タグからハッシュタグを追加（コンテンツに含まれていないもののみ）
  // スーパーメンション変換後の text を渡すことで、@@mention 由来のハッシュタグとの重複もチェック
  const hashtags = extractHashtagsForSns(tags, text)
  if (hashtags.length > 0) {
    text = text + '\n\n' + hashtags.map((t) => `#${t}`).join(' ')
  }

  // 4. 位置情報を追加
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

  // 5. MY PACE URL を追加
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
const X_CHAR_LIMIT = 280

/**
 * Bluesky の文字数制限
 */
const BLUESKY_CHAR_LIMIT = 300

/**
 * Threads の文字数制限
 */
const THREADS_CHAR_LIMIT = 500

/**
 * X (Twitter) の URL 文字数（t.co 短縮後）
 * https:// の URL は全て 23文字として計算される
 */
const X_URL_LENGTH = 23

/**
 * Bluesky の URL 文字数
 * URL は全て 22文字として計算される
 */
const BLUESKY_URL_LENGTH = 22

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
 * テキスト内の URL を検出する正規表現
 */
const URL_REGEX = /https?:\/\/[^\s]+/g

/**
 * X 用の文字数を計算（URL は 23文字固定）
 */
function calculateXCharLength(text: string): number {
  // URL を全て 23文字として計算
  const urls = text.match(URL_REGEX) || []
  let length = text.length

  for (const url of urls) {
    // 実際の URL 長を引いて、23文字を加算
    length = length - url.length + X_URL_LENGTH
  }

  return length
}

/**
 * Bluesky 用の文字数を計算（URL は 22文字固定）
 */
function calculateBlueskyCharLength(text: string): number {
  // URL を全て 22文字として計算
  const urls = text.match(URL_REGEX) || []
  let length = text.length

  for (const url of urls) {
    // 実際の URL 長を引いて、22文字を加算
    length = length - url.length + BLUESKY_URL_LENGTH
  }

  return length
}

/**
 * テキストの文字数を計算（SNS によって URL の扱いが異なる）
 */
function calculateTextLength(text: string, sns: 'x' | 'bluesky' | 'threads'): number {
  if (sns === 'x') {
    return calculateXCharLength(text)
  }
  if (sns === 'bluesky') {
    return calculateBlueskyCharLength(text)
  }
  // Threads は実際の文字数
  return text.length
}

/**
 * 長文を分割
 * 優先順位: 空行 → 単一改行 → 句読点 → 強制分割
 */
export function splitContentForSns(
  content: string,
  tags: string[][],
  url: string,
  charLimit: number,
  sns: 'x' | 'bluesky' | 'threads' = 'x'
): string[] {
  // 分割が不要な場合
  const fullTransformed = transformContentForSns({ content, tags, url })
  if (calculateTextLength(fullTransformed.text, sns) <= charLimit) {
    return [content]
  }

  // 位置情報のオーバーヘッド（最初のパートのみ）
  const locationOverhead = calculateTextLength(
    transformContentForSns({ content: '', tags, url: '', includeUrl: false }).text,
    sns
  )

  // URLのオーバーヘッド（最後のパートのみ）
  const urlOverhead = calculateTextLength('\n\n' + url, sns)

  // パート番号のオーバーヘッド "(99/99)\n" = 9文字程度
  const partOverhead = 10

  // 分割を試みる
  const parts: string[] = []
  let remaining = content
  let isFirst = true

  while (remaining.length > 0) {
    // 各パートで使える文字数を計算
    // 最初のパート: 位置情報 + パート番号
    // 中間パート: パート番号のみ
    // 最後のパート: URL + パート番号（ただし分割中は最後かわからないので、URLありで計算）
    const overhead = isFirst ? locationOverhead + partOverhead : partOverhead
    // 最後のパートになる可能性があるので、URLオーバーヘッドも考慮
    const effectiveLimit = charLimit - overhead - urlOverhead

    // 残りがeffectiveLimit以下なら終了
    const remainingLength = calculateTextLength(remaining, sns)
    if (remainingLength <= effectiveLimit) {
      parts.push(remaining)
      break
    }

    // 区切り位置を探す（X向けの場合、URL長を考慮した実効文字数で判定）
    const cutPoint = findBestCutPointForSns(remaining, effectiveLimit, sns)
    parts.push(remaining.slice(0, cutPoint).trim())
    remaining = remaining.slice(cutPoint).trim()
    isFirst = false
  }

  return parts
}

/**
 * SNS向けの最適な区切り位置を探す
 */
function findBestCutPointForSns(text: string, maxLength: number, sns: 'x' | 'bluesky' | 'threads'): number {
  // 最大文字数に収まる範囲を探す
  let searchEnd = text.length

  // X/Bluesky向けの場合、URL長を考慮して実効文字数で探す
  if (sns === 'x' || sns === 'bluesky') {
    // 二分探索で実効文字数がmaxLength以下になる位置を探す
    let left = 0
    let right = text.length
    while (left < right) {
      const mid = Math.ceil((left + right) / 2)
      if (calculateTextLength(text.slice(0, mid), sns) <= maxLength) {
        left = mid
      } else {
        right = mid - 1
      }
    }
    searchEnd = left
  } else {
    searchEnd = Math.min(text.length, maxLength)
  }

  const searchRange = text.slice(0, searchEnd)
  const minLength = Math.floor(searchEnd * 0.3)

  // 1. 空行で区切る
  const doubleNewline = searchRange.lastIndexOf('\n\n')
  if (doubleNewline > minLength) {
    return doubleNewline + 2
  }

  // 2. 単一改行で区切る
  const singleNewline = searchRange.lastIndexOf('\n')
  if (singleNewline > minLength) {
    return singleNewline + 1
  }

  // 3. 句読点で区切る（。！？.!?）
  const punctuationMatch = searchRange.match(/.*[。！？.!?]/s)
  if (punctuationMatch && punctuationMatch[0].length > minLength) {
    return punctuationMatch[0].length
  }

  // 4. 強制分割（最終手段）
  return searchEnd
}

/**
 * 分割されたパーツを最終的なテキストに変換
 */
function formatSplitParts(parts: string[], tags: string[][], url: string): TransformedContent[] {
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

/**
 * SNS 共有を実行（Intent URL を開く）
 * @param sns - SNS タイプ
 * @param content - 投稿内容
 * @param tags - Nostr タグ
 * @param url - MY PACE の投稿 URL
 * @param partIndex - 分割パートのインデックス（undefined: 分割なし、-1: 全文、0以上: パート番号）
 */
export function openSnsShare(
  sns: 'x' | 'bluesky' | 'threads',
  content: string,
  tags: string[][],
  url: string,
  partIndex?: number
): void {
  let text: string

  if (partIndex === undefined || partIndex === -1) {
    // 全文（分割なし or 編集用）
    const transformed = transformContentForSns({ content, tags, url })
    text = transformed.text
  } else {
    // 分割パート
    const parts = splitContentForSns(content, tags, url, getCharLimit(sns), sns)
    const formatted = formatSplitParts(parts, tags, url)
    text = formatted[partIndex]?.text || ''
  }

  const intentUrl = getSnsIntentUrl(sns, text)
  window.open(intentUrl, '_blank', 'noopener,noreferrer')
}
