import { AD_TAGS, AD_KEYWORDS, NSFW_TAGS, NSFW_KEYWORDS, KIND_SINOV_NPC } from './constants'

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
  const mutedSet = new Set(mutedPubkeys)
  return events.filter((e) => !mutedSet.has(e.pubkey))
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

// 正規表現のエスケープ
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// NGタグフィルタ: 指定タグを含む投稿を除外（タグ配列 + 本文中の#tag）
export function filterByNgTags<T extends { content: string; tags: string[][] }>(events: T[], ngTags: string[]): T[] {
  if (ngTags.length === 0) return events
  const ngTagsLower = ngTags.map((t) => t.toLowerCase())
  // 正規表現を事前コンパイル
  const patterns = ngTagsLower.map(
    (ngTag) =>
      new RegExp(
        `#${escapeRegex(ngTag)}(?=[\\s\\u3000]|$|[^a-zA-Z0-9_\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF])`,
        'i'
      )
  )
  return events.filter((e) => {
    // タグ配列をチェック
    const eventTags = e.tags
      .filter((t) => t[0] === 't')
      .map((t) => t[1]?.toLowerCase())
      .filter(Boolean)
    if (eventTags.some((tag) => ngTagsLower.includes(tag))) {
      return false
    }
    // 本文中の#tagもチェック
    const contentLower = e.content.toLowerCase()
    if (patterns.some((pattern) => pattern.test(contentLower))) {
      return false
    }
    return true
  })
}

// OKタグフィルタ: 指定タグを含む投稿のみ表示（AND: 全て含む必要あり）
export function filterByOkTags<T extends { content: string; tags: string[][] }>(events: T[], okTags: string[]): T[] {
  if (okTags.length === 0) return events
  const okTagsLower = okTags.map((t) => t.toLowerCase())
  // 正規表現を事前コンパイル
  const patterns = okTagsLower.map(
    (okTag) =>
      new RegExp(
        `#${escapeRegex(okTag)}(?=[\\s\\u3000]|$|[^a-zA-Z0-9_\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF])`,
        'i'
      )
  )
  return events.filter((e) => {
    // タグ配列をチェック
    const eventTags = e.tags
      .filter((t) => t[0] === 't')
      .map((t) => t[1]?.toLowerCase())
      .filter(Boolean)
    // 本文中の#tagもチェック
    const contentLower = e.content.toLowerCase()
    // 全てのOKタグが含まれているか確認（AND条件）
    return okTagsLower.every((okTag, i) => {
      // タグ配列に含まれるか
      if (eventTags.includes(okTag)) return true
      // 本文中に#tag形式で含まれるか
      return patterns[i].test(contentLower)
    })
  })
}

// 正規表現を事前コンパイル（モジュールレベルで1回のみ）
const adPatterns = AD_TAGS.map(
  (tag) =>
    new RegExp(`#${escapeRegex(tag)}(?=[\\s\\u3000]|$|[^a-zA-Z0-9_\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF])`, 'i')
)
const nsfwPatterns = NSFW_TAGS.map(
  (tag) =>
    new RegExp(`#${escapeRegex(tag)}(?=[\\s\\u3000]|$|[^a-zA-Z0-9_\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF])`, 'i')
)
const adKeywordsLower = AD_KEYWORDS.map((kw) => kw.toLowerCase())
const nsfwKeywordsLower = NSFW_KEYWORDS.map((kw) => kw.toLowerCase())
const onionPattern = /\.onion(?:\/|$|\s)/i

// スマートフィルタ: 広告/NSFWコンテンツをフィルタ
export function filterBySmartFilters<T extends { content: string; tags: string[][] }>(
  events: T[],
  hideAds: boolean,
  hideNSFW: boolean
): T[] {
  if (!hideAds && !hideNSFW) return events

  return events.filter((e) => {
    const contentLower = e.content.toLowerCase()
    // タグを1回だけ抽出（広告とNSFWで共有）
    const eventTags = e.tags
      .filter((t) => t[0] === 't')
      .map((t) => t[1]?.toLowerCase())
      .filter(Boolean)

    // 広告フィルタ
    if (hideAds) {
      // 構造化タグチェック
      if (eventTags.some((tag) => AD_TAGS.includes(tag))) {
        return false
      }
      // 本文中の#tagもチェック
      if (adPatterns.some((pattern) => pattern.test(contentLower))) {
        return false
      }
      // キーワードチェック（本文）
      if (adKeywordsLower.some((kw) => contentLower.includes(kw))) {
        return false
      }
      // リンクが多すぎる（11個以上）はスパム判定
      if (countUrls(e.content) > 10) {
        return false
      }
    }

    // NSFWフィルタ
    if (hideNSFW) {
      // 構造化タグチェック
      if (eventTags.some((tag) => NSFW_TAGS.includes(tag))) {
        return false
      }
      // 本文中の#tagもチェック
      if (nsfwPatterns.some((pattern) => pattern.test(contentLower))) {
        return false
      }
      // キーワードチェック（本文）
      if (nsfwKeywordsLower.some((kw) => contentLower.includes(kw))) {
        return false
      }
      // .onionリンクはダークウェブへのリンクなのでフィルタ
      if (onionPattern.test(e.content)) {
        return false
      }
    }

    return true
  })
}

// 言語判定（簡易版）
export function detectLanguage(text: string): string {
  // 日本語（ひらがな・カタカナがあれば日本語）
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja'
  // 韓国語（ハングル）
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return 'ko'
  // 中国語（漢字があり、ひらがな・カタカナがない）
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh'
  // スペイン語（特有のアクセント文字）
  if (/[áéíóúüñ¿¡]/i.test(text)) return 'es'
  // フランス語（特有のアクセント文字）
  if (/[àâçéèêëîïôùûü]/i.test(text) && !/[ß]/.test(text)) return 'fr'
  // ドイツ語（特有の文字）
  if (/[äöüß]/i.test(text)) return 'de'
  // デフォルトは英語
  return 'en'
}

// ユーザーの主要言語を判定（英語以外で最も多い言語）
export function detectUserPrimaryLanguage(posts: { content: string }[]): string | null {
  const langCounts: Record<string, number> = {}

  for (const post of posts) {
    const lang = detectLanguage(post.content)
    if (lang !== 'en') {
      // 英語以外をカウント
      langCounts[lang] = (langCounts[lang] || 0) + 1
    }
  }

  // 最も多い言語を返す（英語以外がなければnull）
  let maxLang: string | null = null
  let maxCount = 0
  for (const [lang, count] of Object.entries(langCounts)) {
    if (count > maxCount) {
      maxCount = count
      maxLang = lang
    }
  }

  return maxLang
}

// 言語フィルタを適用（ユーザーの主要言語も考慮）
export function filterByLanguage<T extends { pubkey: string; content: string }>(events: T[], langFilter: string): T[] {
  if (!langFilter) return events

  // ユーザーごとに投稿をグループ化
  const postsByUser: Record<string, T[]> = {}
  for (const event of events) {
    if (!postsByUser[event.pubkey]) {
      postsByUser[event.pubkey] = []
    }
    postsByUser[event.pubkey].push(event)
  }

  // ユーザーごとの主要言語を判定
  const userPrimaryLang: Record<string, string | null> = {}
  for (const [pubkey, posts] of Object.entries(postsByUser)) {
    userPrimaryLang[pubkey] = detectUserPrimaryLanguage(posts)
  }

  // フィルタリング：投稿の言語がマッチ OR ユーザーの主要言語がマッチ
  return events.filter((e) => {
    const postLang = detectLanguage(e.content)
    const userLang = userPrimaryLang[e.pubkey]

    // 投稿自体がフィルタ言語にマッチ
    if (postLang === langFilter) return true

    // ユーザーの主要言語がフィルタ言語にマッチ（英語投稿でも表示）
    if (userLang === langFilter) return true

    return false
  })
}
