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
