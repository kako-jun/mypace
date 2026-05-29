import { describe, it, expect } from 'vitest'
import {
  graphemeCount,
  utf8ByteLength,
  weightedLengthX,
  threadsLength,
  fitsWithinLimit,
  splitContentForSns,
  formatSplitParts,
  getCharLimit,
} from './sns-share'

describe('count helpers (smoke)', () => {
  it('weightedLengthX: CJK は重み2、Latin は重み1', () => {
    expect(weightedLengthX('abc')).toBe(3) // Latin x3
    expect(weightedLengthX('あいう')).toBe(6) // ひらがな x3 (重み2)
  })

  it('weightedLengthX: URL は実長に関わらず 23', () => {
    expect(weightedLengthX('https://example.com/very/long/path/that/exceeds/23chars')).toBe(23)
  })

  it('graphemeCount: 結合絵文字は1書記素', () => {
    expect(graphemeCount('👨‍👩‍👧‍👦')).toBe(1)
    expect(graphemeCount('あい')).toBe(2)
  })

  it('utf8ByteLength: 日本語は3バイト', () => {
    expect(utf8ByteLength('あ')).toBe(3)
    expect(utf8ByteLength('a')).toBe(1)
  })

  it('threadsLength: URL は0字', () => {
    expect(threadsLength('abc https://example.com')).toBe(4) // "abc " のみ
  })

  it('fitsWithinLimit の境界', () => {
    expect(fitsWithinLimit('あ'.repeat(140), 'x')).toBe(true) // weighted 280
    expect(fitsWithinLimit('あ'.repeat(141), 'x')).toBe(false) // weighted 282
    expect(fitsWithinLimit('a'.repeat(300), 'bluesky')).toBe(true)
    expect(fitsWithinLimit('a'.repeat(301), 'bluesky')).toBe(false)
  })
})

describe('splitContentForSns (core fix)', () => {
  const url = 'https://mypace.example/post/abc123'

  it('1パートに収まるなら [content] を返す（既存契約）', () => {
    const parts = splitContentForSns('短い投稿', [], url, getCharLimit('x'), 'x')
    expect(parts).toEqual(['短い投稿'])
  })

  it('X: 長い日本語が分割後、各パートが weighted<=280 に収まる', () => {
    const content = 'あ'.repeat(600)
    const parts = splitContentForSns(content, [], url, getCharLimit('x'), 'x')
    expect(parts.length).toBeGreaterThan(1)
    const formatted = formatSplitParts(parts, [], url)
    for (const p of formatted) {
      expect(weightedLengthX(p.text)).toBeLessThanOrEqual(280)
    }
  })

  it('Bluesky: 絵文字多用でも byte<=3000 かつ grapheme<=300 に収まる', () => {
    const content = '😀'.repeat(2000) // grapheme 2000, byte 8000
    const tags = [['t', 'tag1']]
    const parts = splitContentForSns(content, tags, url, getCharLimit('bluesky'), 'bluesky')
    const formatted = formatSplitParts(parts, tags, url)
    for (const p of formatted) {
      expect(graphemeCount(p.text)).toBeLessThanOrEqual(300)
      expect(utf8ByteLength(p.text)).toBeLessThanOrEqual(3000)
    }
  })

  it('Threads: 分割後の各パートが threadsLength<=500 に収まる', () => {
    const content = 'あ'.repeat(1500)
    const parts = splitContentForSns(content, [], url, getCharLimit('threads'), 'threads')
    const formatted = formatSplitParts(parts, [], url)
    for (const p of formatted) {
      expect(threadsLength(p.text)).toBeLessThanOrEqual(500)
    }
  })
})

// --- 以下 #84 拡充分（既存10件と非重複）。期待値は全て実装を実評価して確定済み ---

describe('weightedLengthX: 境界・文字種混在', () => {
  it('A1: あ*141 = 282（重み2×141）', () => {
    expect(weightedLengthX('あ'.repeat(141))).toBe(282)
  })

  it('A2: Latin の境界 280/281', () => {
    expect(weightedLengthX('a'.repeat(280))).toBe(280)
    expect(weightedLengthX('a'.repeat(281))).toBe(281)
  })

  it('A3: 重み1範囲上端 U+10FF = 1', () => {
    expect(weightedLengthX(String.fromCodePoint(0x10ff))).toBe(1)
  })

  it('A4: U+1100（ハングル, 4352〜）は重み2', () => {
    expect(weightedLengthX(String.fromCodePoint(0x1100))).toBe(2)
  })

  it('A5: 絵文字（サロゲートペア）は1コードポイント・重み2', () => {
    expect(weightedLengthX('😀')).toBe(2)
  })

  it('A6: ZWJ 家族絵文字 = 11（コードポイント分解での重み合計）', () => {
    // 実装は書記素ではなくコードポイント単位で重み付けする。
    // 👨‍👩‍👧‍👦 は 7 コードポイント（絵文字4×重み2 + ZWJ 3×重み1 = 8+3 = 11）。
    // X 実機は grapheme=重み2 として 2 と数えるため、この値は実機と乖離する（実装準拠で固定）。
    expect(weightedLengthX('👨‍👩‍👧‍👦')).toBe(11)
  })

  it('A7: 複数 URL は各23（23×2 + 空白1 = 47）', () => {
    expect(weightedLengthX('https://a.test/x https://b.test/y')).toBe(47)
  })

  it('A8: URL + CJK の混在（空白有無で差が出る）', () => {
    // URL 正規表現が直後の URL を丸ごと食うため、あ(2) + 23 = 25
    expect(weightedLengthX('あhttps://x.test/y')).toBe(25)
    // 空白を挟むと あ(2) + 空白(1) + 23 = 26
    expect(weightedLengthX('あ https://x.test/y')).toBe(26)
  })

  it('A9: 重み1範囲の穴を実測確認', () => {
    expect(weightedLengthX(String.fromCodePoint(8199))).toBe(1) // 8192–8205 範囲
    expect(weightedLengthX(String.fromCodePoint(8208))).toBe(1) // 8208–8223 範囲
    expect(weightedLengthX(String.fromCodePoint(8264))).toBe(2) // 範囲外（重み2）
  })

  it('A10: 空文字列 = 0', () => {
    expect(weightedLengthX('')).toBe(0)
  })
})

describe('graphemeCount: 結合・修飾子・フォールバック', () => {
  it('B1: 結合文字 é = 1 書記素', () => {
    // U+0065 U+0301（e + 結合アクセント）
    expect(graphemeCount('é')).toBe(1)
  })

  it('B2: 肌色修飾子付き 👍🏽 = 1 書記素', () => {
    expect(graphemeCount('👍🏽')).toBe(1)
  })

  it('B3: 空文字列 = 0', () => {
    expect(graphemeCount('')).toBe(0)
  })

  it('B5: 単一絵文字 😀 = 1 書記素', () => {
    expect(graphemeCount('😀')).toBe(1)
  })

  it('B4: Intl.Segmenter 不在時はコードポイント数にフォールバック', () => {
    const IntlAny = Intl as unknown as { Segmenter?: unknown }
    const original = IntlAny.Segmenter
    try {
      IntlAny.Segmenter = undefined
      // フォールバックは Array.from(text).length（コードポイント数）
      expect(graphemeCount('👨‍👩‍👧‍👦')).toBe(7) // 7 コードポイント
      expect(graphemeCount('😀')).toBe(1)
      expect(graphemeCount('あい')).toBe(2)
    } finally {
      IntlAny.Segmenter = original
    }
    // 復元後は書記素単位に戻る
    expect(graphemeCount('👨‍👩‍👧‍👦')).toBe(1)
  })
})

describe('utf8ByteLength', () => {
  it('C1: 絵文字 😀 = 4 バイト', () => {
    expect(utf8ByteLength('😀')).toBe(4)
  })

  it('C2: 空文字列 = 0 バイト', () => {
    expect(utf8ByteLength('')).toBe(0)
  })

  it('C3: U+00E9（é 単一コードポイント）= 2 バイト', () => {
    expect(utf8ByteLength('é')).toBe(2)
  })
})

describe('threadsLength: URL 除外', () => {
  it('D1: URL のみ = 0（URL はカウント対象外）', () => {
    expect(threadsLength('https://x.test/y')).toBe(0)
  })

  it('D2: 複数 URL を含む文は URL 除去後の書記素数', () => {
    // "hello " (6) + "world " (6) + "" ... 実測 13
    expect(threadsLength('hello https://a.test/x world https://b.test/y')).toBe(13)
  })

  it('D3: ZWJ 家族絵文字 = 1 書記素（weighted 11 との対比）', () => {
    expect(threadsLength('👨‍👩‍👧‍👦')).toBe(1)
    expect(weightedLengthX('👨‍👩‍👧‍👦')).toBe(11)
  })
})

describe('fitsWithinLimit: SNS 別の律速', () => {
  it('E2: Bluesky は grapheme 律速（😀×300 true / ×301 false、byte は余裕）', () => {
    // 😀×300 = grapheme 300・byte 1200。grapheme が先に効く。
    expect(fitsWithinLimit('😀'.repeat(300), 'bluesky')).toBe(true)
    expect(fitsWithinLimit('😀'.repeat(301), 'bluesky')).toBe(false)
    expect(utf8ByteLength('😀'.repeat(300))).toBe(1200) // byte は限界の遥か下
  })

  it('E3: X の URL 込み境界（あ×128 true / ×129 false）', () => {
    const at = (n: number) => 'あ'.repeat(n) + ' https://x.test/y'
    expect(weightedLengthX(at(128))).toBe(280) // 256 + 1 + 23
    expect(weightedLengthX(at(129))).toBe(282) // 258 + 1 + 23
    expect(fitsWithinLimit(at(128), 'x')).toBe(true)
    expect(fitsWithinLimit(at(129), 'x')).toBe(false)
  })

  it('E4: Threads 境界（あ×500 true / ×501 false）', () => {
    expect(fitsWithinLimit('あ'.repeat(500), 'threads')).toBe(true)
    expect(fitsWithinLimit('あ'.repeat(501), 'threads')).toBe(false)
  })
})

describe('splitContentForSns: 分割 core 保証（全パートが組み立て後に収まる）', () => {
  const url = 'https://mypace.example/post/abc123longerurlforrealism'

  // 組み立て後の実パートが全て当該 SNS の制限に収まることを検証するヘルパー
  const assertAllFit = (content: string, tags: string[][], sns: 'x' | 'bluesky' | 'threads') => {
    const parts = splitContentForSns(content, tags, url, getCharLimit(sns), sns)
    const formatted = formatSplitParts(parts, tags, url)
    formatted.forEach((p) => expect(fitsWithinLimit(p.text, sns)).toBe(true))
    return { parts, formatted }
  }

  it('F1: X + 位置情報 g タグ + 長文日本語 → 全パート weighted<=280', () => {
    const tags = [['g', 'xn774c', '東京タワー']]
    const { parts } = assertAllFit('あ'.repeat(800), tags, 'x')
    expect(parts.length).toBeGreaterThan(1)
  })

  it('F2: X + t タグ複数 + g タグ + 長文 → 全パート収まる', () => {
    const tags = [
      ['t', '旅行'],
      ['t', 'カメラ'],
      ['g', 'xn774c', '駅'],
    ]
    const { parts } = assertAllFit('あ'.repeat(800), tags, 'x')
    expect(parts.length).toBeGreaterThan(1)
  })

  it('F3: 末尾 URL 付きの最終パートが個別に fitsWithinLimit', () => {
    const parts = splitContentForSns('あ'.repeat(800), [], url, getCharLimit('x'), 'x')
    const formatted = formatSplitParts(parts, [], url)
    const last = formatted[formatted.length - 1]
    expect(last.text).toContain(url) // 最終パートに URL が付く
    expect(fitsWithinLimit(last.text, 'x')).toBe(true)
  })

  it('F4: X 2桁パート数（あ×1500）→ 全パート収まる', () => {
    const { parts } = assertAllFit('あ'.repeat(1500), [], 'x')
    expect(parts.length).toBeGreaterThanOrEqual(10) // 2桁
  })

  it('F5: X 3桁パート数（超長文）→ 全パート収まり、guard<64 上限に達しない', () => {
    const tags: string[][] = []
    const parts = splitContentForSns('あ'.repeat(30000), tags, url, getCharLimit('x'), 'x')
    const formatted = formatSplitParts(parts, tags, url)
    expect(parts.length).toBeGreaterThanOrEqual(100) // 3桁
    formatted.forEach((p) => expect(weightedLengthX(p.text)).toBeLessThanOrEqual(280))
    // guard<64 上限に達していれば最終パートがはみ出す可能性がある。全パート収束＝上限未達。
    expect(formatted.every((p) => fitsWithinLimit(p.text, 'x'))).toBe(true)
  })

  it('F6: Latin 長文（a×2000、強制分割経路）→ 全パート weighted<=280', () => {
    const { parts } = assertAllFit('a'.repeat(2000), [], 'x')
    expect(parts.length).toBeGreaterThan(1)
  })

  it('F7: 絵文字長文（😀×500）X 分割 → lone surrogate 無し・全パート収まる', () => {
    const parts = splitContentForSns('😀'.repeat(500), [], url, getCharLimit('x'), 'x')
    const formatted = formatSplitParts(parts, [], url)
    expect(parts.length).toBeGreaterThan(1)
    for (const p of formatted) {
      expect(weightedLengthX(p.text)).toBeLessThanOrEqual(280)
      // 各コードポイントが lone surrogate（U+D800–U+DFFF）でないこと
      for (const ch of [...p.text]) {
        const cp = ch.codePointAt(0)!
        expect(cp < 0xd800 || cp > 0xdfff).toBe(true)
      }
    }
  })

  it('F8: Threads + g タグ長文 → 全パート threadsLength<=500', () => {
    const tags = [['g', 'xn774c', '駅']]
    const parts = splitContentForSns('あ'.repeat(2000), tags, url, getCharLimit('threads'), 'threads')
    const formatted = formatSplitParts(parts, tags, url)
    expect(parts.length).toBeGreaterThan(1)
    formatted.forEach((p) => expect(threadsLength(p.text)).toBeLessThanOrEqual(500))
  })

  it('F9: Bluesky byte 律速（ZWJ 家族×130: grapheme130<300 だが byte3250>3000）→ 全パート byte<=3000 かつ grapheme<=300', () => {
    // #84 の本質: grapheme だけ見ると 1 パートで収まるが、UTF-8 byte が制限超過。
    // 1 書記素 ≈ 25 byte の ZWJ 家族絵文字を 130 個並べると grapheme 130・byte 3250。
    const zwj = '👨‍👩‍👧‍👦'
    const content = zwj.repeat(130)
    expect(graphemeCount(content)).toBe(130) // grapheme 制限(300)以下
    expect(utf8ByteLength(content)).toBe(3250) // byte 制限(3000)超過 → 分割が必須
    const parts = splitContentForSns(content, [], url, getCharLimit('bluesky'), 'bluesky')
    const formatted = formatSplitParts(parts, [], url)
    expect(parts.length).toBeGreaterThan(1) // byte 律速で分割される
    for (const p of formatted) {
      expect(utf8ByteLength(p.text)).toBeLessThanOrEqual(3000)
      expect(graphemeCount(p.text)).toBeLessThanOrEqual(300)
    }
  })

  it('F10: 意味区切り優先（空行入り長文は \\n\\n で区切られ、段落が混ざらない）', () => {
    // 各段落 200 字（weighted 400）は単独で 1 パートに収まらないので段落内でさらに分割されるが、
    // 段落をまたいで結合されない（最初のパートは あ のみで構成される）ことを確認。
    const content = 'あ'.repeat(200) + '\n\n' + 'い'.repeat(200) + '\n\n' + 'う'.repeat(200)
    const parts = splitContentForSns(content, [], url, getCharLimit('x'), 'x')
    expect(parts.length).toBeGreaterThan(1)
    // 先頭パートは あ のみ（段落をまたいで い/う が混ざらない）
    expect(/^あ+$/.test(parts[0])).toBe(true)
    // 全パートが単一文字種のみ（段落混在が起きていない）
    for (const p of parts) {
      const kinds = new Set([...p].filter((c) => c !== '\n'))
      // 各パートは あ/い/う のいずれか1種のみ
      expect(kinds.size).toBeGreaterThan(0)
      expect([...kinds].every((c) => c === [...kinds][0])).toBe(true)
    }
  })
})

describe('splitContentForSns: 異常系・退行', () => {
  const url = 'https://mypace.example/post/abc123'

  it('G1: 空 content → [""]（実装挙動）', () => {
    expect(splitContentForSns('', [], url, getCharLimit('x'), 'x')).toEqual([''])
  })

  it('G2: URL だけの長い content → 分割されず [content]（weighted 23 で収まる）', () => {
    const content = 'https://example.com/' + 'x'.repeat(500)
    expect(weightedLengthX(content)).toBe(23) // URL は1個=23
    expect(splitContentForSns(content, [], url, getCharLimit('x'), 'x')).toEqual([content])
  })

  it('G3: 改行のみの content → 破綻せず実測値を返す', () => {
    // weighted 0 で制限内 → そのまま [content]
    expect(splitContentForSns('\n\n\n\n', [], url, getCharLimit('x'), 'x')).toEqual(['\n\n\n\n'])
  })

  it('G4: 句読点・改行皆無の超長文（あ×5000）→ 全パート収まり guard 破綻なし', () => {
    const parts = splitContentForSns('あ'.repeat(5000), [], url, getCharLimit('x'), 'x')
    const formatted = formatSplitParts(parts, [], url)
    expect(parts.length).toBeGreaterThan(1)
    // guard<64 上限未達＝全パート収束
    expect(formatted.every((p) => fitsWithinLimit(p.text, 'x'))).toBe(true)
  })

  it('G6: content に既存 #旅行 がある場合、t タグ由来のハッシュタグを重複追加しない', () => {
    const tagged = [['t', '旅行']]
    // 既存 #旅行 あり → ハッシュタグ block を付けない
    const dup = formatSplitParts(splitContentForSns('#旅行 の話', tagged, url, getCharLimit('x'), 'x'), tagged, url)
    expect(dup[0].text).not.toContain('\n\n#旅行')
    // 既存ハッシュタグ無し → #旅行 block を付ける（対比）
    const nondup = formatSplitParts(splitContentForSns('カメラの話', tagged, url, getCharLimit('x'), 'x'), tagged, url)
    expect(nondup[0].text).toContain('\n\n#旅行')
  })
})
