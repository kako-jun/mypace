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

  it('threadsLength: URL も実長で計上', () => {
    // Threads は t.co 短縮がなく URL も本文と同じく実長（書記素数）で計上される。
    expect(threadsLength('abc https://example.com')).toBe(graphemeCount('abc https://example.com')) // 全23字
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

describe('threadsLength: URL も実長で計上', () => {
  it('D1: URL のみ = 実長（書記素数。X と違い短縮されない）', () => {
    expect(threadsLength('https://x.test/y')).toBe(graphemeCount('https://x.test/y')) // 実測 16
  })

  it('D2: 複数 URL を含む文は本文丸ごとの書記素数', () => {
    const s = 'hello https://a.test/x world https://b.test/y'
    expect(threadsLength(s)).toBe(graphemeCount(s)) // 実測 45
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

describe('splitContentForSns: 強制分割で書記素クラスタが割れない (S1)', () => {
  const url = 'https://mypace.example/post/abc123'
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const ZWJ = '‍'

  // 1パートのテキストが書記素として壊れていない（dangling ZWJ / lone surrogate 無し）ことを検証
  const assertIntactGraphemes = (text: string) => {
    // 先頭/末尾が ZWJ で始まる/終わる ＝ 書記素クラスタが分断された証拠
    expect(text.startsWith(ZWJ)).toBe(false)
    expect(text.endsWith(ZWJ)).toBe(false)
    for (const ch of [...text]) {
      const cp = ch.codePointAt(0)!
      // lone surrogate（U+D800–U+DFFF）が単独で存在しないこと
      expect(cp < 0xd800 || cp > 0xdfff).toBe(true)
    }
    // 各セグメントが内部に dangling ZWJ を残さない（完全な書記素であること）
    for (const { segment } of seg.segment(text)) {
      // ZWJ で始まる/終わるセグメントは壊れた書記素片
      expect(segment.startsWith(ZWJ) && segment.length === 1).toBe(false)
    }
  }

  it('H1: Bluesky ZWJ 家族絵文字×200 を強制分割 → 各パートで書記素が割れない', () => {
    const family = '👨‍👩‍👧‍👦'
    const parts = splitContentForSns(family.repeat(200), [], url, getCharLimit('bluesky'), 'bluesky')
    const formatted = formatSplitParts(parts, [], url)
    expect(parts.length).toBeGreaterThan(1)
    for (const p of formatted) {
      assertIntactGraphemes(p.text)
      expect(graphemeCount(p.text)).toBeLessThanOrEqual(300)
      expect(utf8ByteLength(p.text)).toBeLessThanOrEqual(3000)
    }
  })

  it('H2: X ZWJ 家族絵文字×100 を強制分割 → 各パートで書記素が割れない', () => {
    const family = '👨‍👩‍👧‍👦'
    const parts = splitContentForSns(family.repeat(100), [], url, getCharLimit('x'), 'x')
    const formatted = formatSplitParts(parts, [], url)
    expect(parts.length).toBeGreaterThan(1)
    for (const p of formatted) {
      assertIntactGraphemes(p.text)
      expect(weightedLengthX(p.text)).toBeLessThanOrEqual(280)
    }
  })

  it('H3: 各 part を再分解しても全セグメントが元の家族絵文字の完全な片であること', () => {
    const family = '👨‍👩‍👧‍👦'
    const parts = splitContentForSns(family.repeat(200), [], url, getCharLimit('bluesky'), 'bluesky')
    // formatSplitParts 前の生パート（本文のみ）も検証: 各パートは家族絵文字の整数個で構成される
    for (const part of parts) {
      const segments = [...seg.segment(part)].map((s) => s.segment)
      for (const s of segments) {
        // 本文セグメントは家族絵文字そのものであるべき（割れた片でない）
        expect(s === family).toBe(true)
      }
    }
  })
})

describe('splitContentForSns: タグ過多で第1パート超過の既知限界 (S2)', () => {
  const url = 'https://mypace.example/post/abc123'

  it('I1: 大量の長い t タグ → クラッシュせず有限個のパートを返す（全パート収まる保証は無い）', () => {
    // 各タグ単体で X 制限近くになる長さのタグを大量に付ける。
    // 第1パートのハッシュタグ群だけで制限超過し得るが、関数は収束して配列を返す。
    const tags: string[][] = Array.from({ length: 30 }, (_, i) => ['t', 'タグ'.repeat(20) + i])
    const content = 'あ'.repeat(400)
    let parts: string[] = []
    expect(() => {
      parts = splitContentForSns(content, tags, url, getCharLimit('x'), 'x')
    }).not.toThrow()
    // 有限個・非空のパートを返す（無限ループや空配列にならない）
    expect(parts.length).toBeGreaterThan(0)
    expect(Number.isFinite(parts.length)).toBe(true)
  })
})

// --- 以下 SNS 分割ガード回帰（cutOnePart の「残り全体が1パートに収まるなら区切り探索を ---
// --- スキップして全取り」ガード）。期待値は実装の修正前/後を実評価して確定済み。 ---
//
// 構造的前提（後任が誤らないために必読）:
//   splitContentForSns は冒頭で「全文+url が収まれば [content] を即 return」する早期 return がある。
//   このガードはその先（全文は収まらないが、分割途中の末尾スライスが1パートに収まる）でのみ到達する。
//   よってガードを踏むテストは「先頭に分割必須の塊 + その後に1パートに収まる末尾」という構造が必須で、
//   短文単発はガードを通らない（早期 return される）。
describe('splitContentForSns: 分割ガード（末尾の過剰分割を防ぐ）', () => {
  // 実投稿本文（おおさかけんぽうの宣伝投稿）。末尾改行なし。J1/J2 で共有する。
  // 先頭にいくつか段落があり、後半は1パートに収まる末尾を持つ＝ガードを踏む実例。
  const REAL_POST = `おおさかけんぽうは、ターゲットが開発者でなく
日本限定なので多言語化の必要がない、という
私にとっては珍しいアプリだった

でも、これくらいサーバー負荷があった
https://image.nostr.build/ec577eecc0cce2afe596ce20e6a9fca3b7e2f6095c3669f22301e731298d5c15.jpg

サーバーのコードを微修正した効果があって
まだ無料プランでもレートに引っ掛かってない

次にリリース予定の、orberという動画素材作成ツール
AgasteerというPC, スマホ共通のMarkdownエディタは
ターゲットが世界だし

そのあたりで有料プランが必要になり
Cloudflareの思う壺に……

つまり、いまCloudflareが私に見せてる顔は
カイジにビールをプレゼントしてるときのハンチョウの顔`
  const realTags = [['t', 'mypace']]
  const realUrl = 'https://mypace.llll-ll.com/post/ce2bba761e95c5b84f12212e42356708e30a105ffe6d5f53cd9ca452177af570'
  // ガードの境界（>= の =）を突くテストで使う共通 url（partInfo/url オーバーヘッドを実測するため）
  const url = 'https://mypace.example/post/abc123'

  // L1/L2 共有ヘルパー: ガード境界（最終パート weighted がちょうど X 予算 280）に乗る末尾入力と、
  // そこに 1 weighted（=1 コードポイント）足して予算を超える入力を、対で返す。
  //
  // 構造: 先頭に分割必須の塊（a×250）＋末尾に「\n\n で2分割した weight1 本文」を置く。
  //   末尾本文 weighted = 280 - overhead（partInfo + "\n\n" + url のオーバーヘッドを実測）。
  //   \n\n 自体も weighted 2 を消費するため、weight1 文字数 bc = (280 - overhead) - 2。
  // マジックナンバー（244 等）は直書きせず weightedLengthX から動的に解く。
  //
  // 戻り値:
  //   atBudget   … 最終パート weighted === 280 ちょうど（境界 = をガードが取り込む側）
  //   overBudget … atBudget の末尾に 1 コードポイント足した（境界の反対側＝予算超過で割れる側）
  const buildBoundaryTailInputs = () => {
    const head = 'a'.repeat(250) // 先頭の分割必須の塊
    // 末尾本文の weight1 文字数 = bc。間に \n\n を1つ挟む。
    const buildTail = (bc: number) => 'b'.repeat(Math.floor(bc / 2)) + '\n\n' + 'c'.repeat(bc - Math.floor(bc / 2))
    const buildInput = (bc: number) => head + '\n\n' + buildTail(bc)

    // オーバーヘッド実測: 余裕で収まる末尾(60)で分割させ、最終パートの全文 weighted と本文 weighted の差を取る。
    const probeTail = buildTail(60)
    const probeParts = splitContentForSns(buildInput(60), [], url, getCharLimit('x'), 'x')
    const probeFmt = formatSplitParts(probeParts, [], url)
    const overhead = weightedLengthX(probeFmt[probeFmt.length - 1].text) - weightedLengthX(probeTail)

    // 末尾本文（\n\n 込み）weighted = 280 - overhead。bc = それ - 2（\n\n の weighted 2 を差し引く）。
    const X_LIMIT = 280
    const bcBoundary = X_LIMIT - overhead - 2

    return {
      X_LIMIT,
      atBudget: buildInput(bcBoundary), // 最終パート weighted ちょうど 280
      overBudget: buildInput(bcBoundary + 1), // 1 コードポイント超過
    }
  }

  it('J1: X 実投稿本文が過剰分割されない（孤立行を出さない）', () => {
    // 修正前: 5パート weighted[195,210,65,46,83]（part4=46 の孤立行）
    // 修正後: 3パート weighted[195,210,185]
    const parts = splitContentForSns(REAL_POST, realTags, realUrl, getCharLimit('x'), 'x')
    const formatted = formatSplitParts(parts, realTags, realUrl)
    // パート数: 修正前=5 を確実に下回り、修正後=3 に1マージン（ちょうど3には固定しない=脆さ回避）
    expect(parts.length).toBeLessThanOrEqual(4)
    // 孤立行防止: 各パートの組み立て後 weighted の min/max 比が極端でないこと。
    // 修正前の part4=46/210≈0.22 を弾き、修正後 185/210≈0.88 は余裕で通る。
    const weights = formatted.map((p) => weightedLengthX(p.text))
    const ratio = Math.min(...weights) / Math.max(...weights)
    expect(ratio).toBeGreaterThanOrEqual(0.3)
    // 保険: 各パートが個別に X 制限に収まる
    formatted.forEach((p) => expect(fitsWithinLimit(p.text, 'x')).toBe(true))
  })

  it('J2: Bluesky 実投稿本文でも孤立片が出ない', () => {
    // 修正前: 4パート（最小 grapheme=31 の孤立片）/ 修正後: 3パート（本文 grapheme[175,154,52]）
    const parts = splitContentForSns(REAL_POST, realTags, realUrl, getCharLimit('bluesky'), 'bluesky')
    expect(parts.length).toBeLessThanOrEqual(4)
    // 最小パートの本文書記素数が孤立片レベル（修正前 31）でないこと。
    const minGrapheme = Math.min(...parts.map((p) => graphemeCount(p)))
    expect(minGrapheme).toBeGreaterThan(50)
  })

  it('K1: 分割経路でのみガードが踏まれる（早期 return と区別）', () => {
    // 先頭に分割必須の塊（a×250）＋末尾は1パートに収まる2段落（p×40, q×40）。
    // 末尾スライスでガードが真になり、p/q が \n\n で割れずに1パートへまとまる。
    // 注意: 短文単発はこのガードを通らない（splitContentForSns 冒頭の早期 return で [content] が返る）。
    //       ガードを踏むには必ず「先頭=分割必須 + 末尾=1パートに収まる」構造が要る。
    const input = 'a'.repeat(250) + '\n\n' + ('p'.repeat(40) + '\n\n' + 'q'.repeat(40))
    const parts = splitContentForSns(input, [], url, getCharLimit('x'), 'x')
    // 修正前: 3パート[249,43,40] / 修正後: 2パート[249,85]。
    // この合成入力は実装詳細から十分隔離されており固定してよい。
    expect(parts.length).toBe(2)
  })

  it('L1: ぴったり収まる末尾＋中間空行 → 割らず全取り（境界 >= の = を保証）', () => {
    // 末尾の「2段落（間に \n\n）」を、組み立て後の最終パート weighted がちょうど X 予算(280)に
    // 等しくなる長さで組む。ガードが `>` 誤実装だと境界で割れる点を突く。
    // 逆算・実測のセットアップは buildBoundaryTailInputs（L2 と共有）に集約。
    const { X_LIMIT, atBudget } = buildBoundaryTailInputs()

    const partsL1 = splitContentForSns(atBudget, [], url, getCharLimit('x'), 'x')
    const fmtL1 = formatSplitParts(partsL1, [], url)
    // 末尾2段落が1パートにまとまる（=PRE 想定よりパート数が少ない）。最終パートの weighted は
    // ちょうど予算 280 に等しい（= 境界の = をガードが取り込んでいる証拠）。
    expect(weightedLengthX(fmtL1[fmtL1.length - 1].text)).toBe(X_LIMIT)
    // 末尾側がまとまっている＝末尾2段落が別パートに割れていない（最終パートに b と c が同居）。
    expect(/b+\n*c+$|c+$/.test(partsL1[partsL1.length - 1])).toBe(true)

    // L2 と対で参照するため境界パート数を公開（同 describe 内の L2 で +1 を確認）
    expect(partsL1.length).toBe(2)
  })

  it('L2: 1文字超過なら従来どおり区切りで分割（境界の反対側・退行なし）', () => {
    // L1 の末尾を1 weighted（=1コードポイント）増やすと予算 280 を超え、ガード偽 → 区切り探索で割れる。
    // atBudget（L1 が踏む境界）と overBudget（その +1 コードポイント）を同じヘルパーで対生成し、
    // overBudget が L1 より1パート多いことを確認する。
    const { atBudget, overBudget } = buildBoundaryTailInputs()

    const partsL1 = splitContentForSns(atBudget, [], url, getCharLimit('x'), 'x')
    const partsL2 = splitContentForSns(overBudget, [], url, getCharLimit('x'), 'x')
    // 反対側: 1超過で末尾が区切りで割れ、パート数が L1 より1多い（退行していないことの担保）。
    expect(partsL2.length).toBe(partsL1.length + 1)
  })
})
