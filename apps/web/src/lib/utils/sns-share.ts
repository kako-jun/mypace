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
 * X (Twitter) の文字数制限（weighted length）
 * 日本語など重み2の文字のみなら最大140字相当
 */
const X_CHAR_LIMIT = 280

/**
 * Bluesky の文字数制限（書記素）
 */
const BLUESKY_GRAPHEME_LIMIT = 300

/**
 * Bluesky の文字数制限（UTF-8 バイト）
 * graphemes と bytes の両方を満たす必要がある（先に達した方が効く）
 */
const BLUESKY_BYTE_LIMIT = 3000

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
 * SNSの文字数制限を取得（後方互換用のスカラー上限）
 * 分割の中核判定は fitsWithinLimit（実カウント）で行う。
 * Bluesky は2制限（grapheme/byte）あるため、ここでは grapheme 上限を返す。
 */
export function getCharLimit(sns: 'x' | 'bluesky' | 'threads'): number {
  switch (sns) {
    case 'x':
      return X_CHAR_LIMIT
    case 'bluesky':
      return BLUESKY_GRAPHEME_LIMIT
    case 'threads':
      return THREADS_CHAR_LIMIT
  }
}

/**
 * テキスト内の URL を検出する正規表現
 */
const URL_REGEX = /https?:\/\/[^\s]+/g

/**
 * 書記素（grapheme）数を数える
 * Intl.Segmenter が使えない環境ではコードポイント数でフォールバック
 */
export function graphemeCount(text: string): number {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    let count = 0
    for (const _ of seg.segment(text)) count++
    return count
  }
  // フォールバック: コードポイント数（サロゲートペアを1とカウント）
  return Array.from(text).length
}

/**
 * UTF-8 バイト長
 */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

/**
 * X (twitter-text) 準拠の weighted length を計算
 * 重み1のコードポイント範囲: 0–4351, 8192–8205, 8208–8223, 8242–8247
 * それ以外（CJK・絵文字・多くの非Latin）は重み2
 * URL は実長に関わらず 23 として加算
 */
export function weightedLengthX(text: string): number {
  // URL 部分を除いたテキストの weighted length に、23×URL個数 を加える
  const urls = text.match(URL_REGEX) || []
  let work = text
  for (const url of urls) {
    work = work.replace(url, '')
  }

  let weight = 0
  for (const ch of work) {
    const cp = ch.codePointAt(0) ?? 0
    const isLight =
      (cp >= 0 && cp <= 4351) || (cp >= 8192 && cp <= 8205) || (cp >= 8208 && cp <= 8223) || (cp >= 8242 && cp <= 8247)
    weight += isLight ? 1 : 2
  }

  return weight + urls.length * X_URL_LENGTH
}

/**
 * Threads の文字数（URL はカウント対象外=0字、絵文字/CJK=1字）
 * = URL を除いた書記素数
 */
export function threadsLength(text: string): number {
  const urls = text.match(URL_REGEX) || []
  let work = text
  for (const url of urls) {
    work = work.replace(url, '')
  }
  return graphemeCount(work)
}

/**
 * 各 SNS の実制限にテキストが収まるか判定
 * - X: weightedLengthX <= 280
 * - Bluesky: graphemeCount <= 300 かつ utf8ByteLength <= 3000
 * - Threads: threadsLength <= 500
 */
export function fitsWithinLimit(text: string, sns: 'x' | 'bluesky' | 'threads'): boolean {
  switch (sns) {
    case 'x':
      return weightedLengthX(text) <= X_CHAR_LIMIT
    case 'bluesky':
      return graphemeCount(text) <= BLUESKY_GRAPHEME_LIMIT && utf8ByteLength(text) <= BLUESKY_BYTE_LIMIT
    case 'threads':
      return threadsLength(text) <= THREADS_CHAR_LIMIT
  }
}

/**
 * 与えられた content スライスが、組み立て後の実パートとして当該 SNS の制限に収まるか判定する。
 * partInfo/位置情報/URL のオーバーヘッドを「実際にパートを組み立てて」実カウントで検証する。
 */
function partFits(
  content: string,
  tags: string[][],
  url: string,
  sns: 'x' | 'bluesky' | 'threads',
  opts: { isFirst: boolean; isLast: boolean; total: number }
): boolean {
  // パート番号オーバーヘッドは桁数が効く。current は total と同桁の最悪値で見積もる
  // （current <= total なので total の桁数が最大）。これにより 3桁パート番号でも過小評価しない。
  const worstCurrent = opts.total
  const partInfo = opts.total > 1 ? { current: worstCurrent, total: opts.total } : undefined
  const partTags = opts.isFirst ? tags : []
  const { text } = transformContentForSns({
    content,
    tags: partTags,
    url,
    partInfo,
    includeUrl: opts.isLast,
  })
  return fitsWithinLimit(text, sns)
}

/**
 * コードポイント単位の cut 位置を、書記素（grapheme）境界の手前へ丸める。
 * 強制分割で書記素クラスタ（ZWJ 絵文字・結合文字・サロゲートペア）が
 * 2パートに割れるのを防ぐ。最低でも1書記素は前進させる（無限ループ防止）。
 *
 * 性能のため cutCp 近傍の窓（±WINDOW コードポイント）だけを segment する。
 * 実在の書記素（ZWJ 家族 7-11cp、旗・keycap・肌色修飾子等）は全て WINDOW 未満で
 * 内包されるが、**単一の書記素クラスタが WINDOW コードポイントを超える病的入力**
 * （例: 1文字に結合マークを数十個付けた Zalgo テキスト）では真の境界が窓外になり
 * 書記素が割れ得る（保証外）。
 *
 * @param chars - 対象スライス（コードポイント配列）
 * @param cutCp - 切りたいコードポイント index（chars 上の境界）
 * @returns 書記素境界に丸めた後のコードポイント index（>=1）
 */
function snapToGraphemeBoundary(chars: string[], cutCp: number): number {
  if (cutCp >= chars.length) return cutCp
  if (cutCp <= 0) return Math.min(1, chars.length)
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') {
    // Segmenter 不在環境ではコードポイント単位のまま（フォールバック）。
    return Math.max(1, cutCp)
  }
  // 性能対策: 全スライスを segment すると長文で O(parts×len) になる。
  // cut 点の周辺だけを窓として切り出して segment し、相対境界を求める。
  // 書記素クラスタ（ZWJ 絵文字・結合列）は通常数コードポイントなので、
  // 窓幅 WINDOW は十分なマージンを取れば cut 点を含む書記素を必ず内包する。
  const WINDOW = 64
  const windowStart = Math.max(0, cutCp - WINDOW)
  const windowEnd = Math.min(chars.length, cutCp + WINDOW)
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

  // 窓内での書記素開始位置（windowStart からの相対コードポイント index）を列挙。
  const relCut = cutCp - windowStart
  let rel = 0
  const boundaries: number[] = []
  for (const { segment } of seg.segment(chars.slice(windowStart, windowEnd).join(''))) {
    boundaries.push(rel)
    rel += Array.from(segment).length
  }
  boundaries.push(rel) // 窓末尾も境界

  // relCut 以下で最大の書記素境界に丸める（cutCp を含む書記素の手前へ後退）。
  let snappedRel = 0
  for (const b of boundaries) {
    if (b <= relCut) snappedRel = b
    else break
  }
  const snapped = windowStart + snappedRel
  // 最低1コードポイントは前進させる（snapped が現在位置と同じなら無限ループ）。
  // ここでは「パート先頭からの 0」と区別するため、1未満になることはないが念のため担保。
  return Math.max(1, snapped)
}

/**
 * 1パート分の content スライスを、組み立て後の実パートが制限に収まる最大長で切り出す。
 * 二分探索で「収まる最大のコードポイント数」を求め、その範囲で意味的な区切り位置を探す。
 */
function cutOnePart(
  remaining: string,
  tags: string[][],
  url: string,
  sns: 'x' | 'bluesky' | 'threads',
  opts: { isFirst: boolean; total: number }
): number {
  const chars = Array.from(remaining)

  // 実パートが収まる最大のコードポイント数を二分探索。
  // どのパートも最後になり得る（URL が付く）ものとして isLast:true で予算を確保し、
  // 最後のパートに URL を付けても収まることを保証する（過剰に詰めるが安全）。
  // N2: 最終以外のパートにも URL 予算を確保するため過剰だが安全（パート数がやや増えるだけ）。
  let left = 0
  let right = chars.length
  while (left < right) {
    const mid = Math.ceil((left + right) / 2)
    const slice = chars.slice(0, mid).join('')
    if (partFits(slice, tags, url, sns, { isFirst: opts.isFirst, isLast: true, total: opts.total })) {
      left = mid
    } else {
      right = mid - 1
    }
  }

  // 何も入らない場合でも前進させるため最低1コードポイントは進める
  const maxChars = Math.max(1, left)
  const searchEnd = maxChars
  const searchRange = chars.slice(0, searchEnd).join('')
  // Q1: 区切り位置が searchEnd の前30%より手前なら短すぎるパートを避け、強制分割へフォールバック
  //     する経験的閾値。
  const minLength = Math.floor(searchEnd * 0.3)

  // 区切り候補はコードポイント数で評価して chars index に揃える
  const toCharIndex = (strLen: number) => Array.from(searchRange.slice(0, strLen)).length

  // 1. 空行で区切る（区切り文字は単一コードポイントなので元々書記素境界）
  const doubleNewline = searchRange.lastIndexOf('\n\n')
  if (doubleNewline >= 0 && toCharIndex(doubleNewline) > minLength) {
    return toCharIndex(doubleNewline + 2)
  }

  // 2. 単一改行で区切る
  const singleNewline = searchRange.lastIndexOf('\n')
  if (singleNewline >= 0 && toCharIndex(singleNewline) > minLength) {
    return toCharIndex(singleNewline + 1)
  }

  // 3. 句読点で区切る（。！？.!?）
  const punctuationMatch = searchRange.match(/.*[。！？.!?]/s)
  if (punctuationMatch && toCharIndex(punctuationMatch[0].length) > minLength) {
    return toCharIndex(punctuationMatch[0].length)
  }

  // 4. 強制分割（最終手段）
  //    S1: コードポイント境界（searchEnd）で切ると書記素クラスタが割れる
  //    （ZWJ 絵文字・結合文字）。最も近い手前の書記素境界へスナップして分断を防ぐ。
  //    短くなるだけなので fitsWithinLimit は引き続き満たす。
  return snapToGraphemeBoundary(chars, searchEnd)
}

/**
 * 指定 total を前提に content を分割し、コードポイント単位の各パート文字列を返す。
 * 各パートは組み立て後の実パートが制限に収まるよう切り出される。
 */
function splitWithTotal(
  content: string,
  tags: string[][],
  url: string,
  sns: 'x' | 'bluesky' | 'threads',
  assumedTotal: number
): string[] {
  const parts: string[] = []
  let remaining = content
  let isFirst = true

  while (remaining.length > 0) {
    const cutChars = cutOnePart(remaining, tags, url, sns, { isFirst, total: assumedTotal })
    const chars = Array.from(remaining)
    // Q2: パート境界の前後空白を除去する（行頭/行末の意図的なスペースは失われる）。
    const head = chars.slice(0, cutChars).join('').trim()
    parts.push(head)
    remaining = chars.slice(cutChars).join('').trim()
    isFirst = false
  }

  return parts.filter((p) => p.length > 0)
}

/**
 * 全パートが組み立て後に実制限に収まっているか検証する。
 */
function allPartsFit(parts: string[], tags: string[][], url: string, sns: 'x' | 'bluesky' | 'threads'): boolean {
  const formatted = formatSplitParts(parts, tags, url)
  return formatted.every((p) => fitsWithinLimit(p.text, sns))
}

/**
 * 長文を分割
 * 優先順位: 空行 → 単一改行 → 句読点 → 強制分割
 *
 * 各パートは「パート番号・ハッシュタグ・位置情報・URL を付与した組み立て後の実パート」が
 * 当該 SNS の実制限（X=weighted280 / Bluesky=grapheme300&byte3000 / Threads=url0で500）に
 * 収まることを保証する。total 確定後にパート番号の桁数まで含めて再検証し、はみ出していれば
 * total を増やして再分割する。
 *
 * charLimit は後方互換のため受け取るが、収まり判定には fitsWithinLimit（実カウント）を使う。
 *
 * 既知の限界（S2）: ハッシュタグ（t タグ由来）や位置情報は第1パートにのみ固定で付与される。
 * 本文を空にしてもこの固定オーバーヘッドだけで SNS 制限を超える場合、第1パートは制限内に
 * 収まらない。その場合 guard 上限で打ち切り、可能な限り詰めたパートを返す（黙って超過パートを返す）。
 *
 * 計算コスト（N1）: assumedTotal を増やすたびに content 全体を再分割するため、極端な長文では
 * O(parts × len) 程度のコストになる。通常の投稿長では問題にならない。
 */
export function splitContentForSns(
  content: string,
  tags: string[][],
  url: string,
  _charLimit: number,
  sns: 'x' | 'bluesky' | 'threads' = 'x'
): string[] {
  // 分割が不要な場合（既存契約: そのまま [content] を返す）
  const fullTransformed = transformContentForSns({ content, tags, url })
  if (fitsWithinLimit(fullTransformed.text, sns)) {
    return [content]
  }

  // total はパート番号の桁数に影響するため、収束するまで仮定 total を上げて再分割する。
  // 初回は total 不明なので大きめ（2桁分の余裕）を仮定して分割し、得られた個数で再検証。
  let assumedTotal = 2
  let parts = splitWithTotal(content, tags, url, sns, assumedTotal)

  // 反復: 実際の個数 > 仮定 total なら、桁数が増えるので仮定を実個数に合わせて再分割。
  // さらに組み立て後の実検証が通るまで total を増やす（無限ループ防止に上限を設ける）。
  for (let guard = 0; guard < 64; guard++) {
    const actualTotal = parts.length
    const effectiveTotal = Math.max(assumedTotal, actualTotal)

    // 仮定 total が実個数より小さい（=桁数を過小見積もり）なら合わせ直して再分割
    if (effectiveTotal !== assumedTotal) {
      assumedTotal = effectiveTotal
      parts = splitWithTotal(content, tags, url, sns, assumedTotal)
      continue
    }

    // 組み立て後の全パートが収まっていれば確定
    if (allPartsFit(parts, tags, url, sns)) {
      return parts
    }

    // まだはみ出すパートがある（境界での桁上がり等）→ total を1つ増やして予算を下げ再分割
    assumedTotal += 1
    parts = splitWithTotal(content, tags, url, sns, assumedTotal)
  }

  // 上限に達した場合も、現時点で得られている分割を返す（pathological 入力の保険）
  return parts
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
