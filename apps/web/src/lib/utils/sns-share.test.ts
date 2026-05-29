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
