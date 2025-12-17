# テキスト装飾計画

## 概要

長文を書くフォント職人向けの文字装飾機能。HTMLは許可しないが、`<font>`タグの最小限の機能だけ認識する。

色やサイズで強調・整理して読みやすくするための機能。点滅やスクロールのような派手な装飾は対象外。

## 方針

- 完全なHTMLは許可しない（セキュリティ・一貫性のため）
- `<font>`タグだけをホワイトリストで許可
- アライメント構文（`<<`, `>>`, `><`, `<>`）と併用可能
- HTMLに慣れた人には自然な記法

## サポートする属性

| 属性 | 説明 | 例 |
|------|------|-----|
| `color` | 文字色 | `<font color="red">`, `<font color="#FF0000">` |
| `size` | サイズ（1-7） | `<font size="5">` |

### color

色名またはHEX値:
```
<font color="red">赤い文字</font>
<font color="blue">青い文字</font>
<font color="#FF5500">カスタム色</font>
<font color="#F00">短縮HEX</font>
```

**対応形式:**
- 色名（ホワイトリスト）: red, blue, green, yellow, orange, purple, pink, cyan, magenta, lime, navy, teal, maroon, white, black, gray/grey, silver
- HEX値: `#RGB` または `#RRGGBB` 形式

**対応しない形式:**
- `rgb()`, `rgba()`, `hsl()` などのCSS関数
- 任意の色名（ホワイトリスト外）

### size

**1〜7 の整数のみ対応**（それ以外は無視）

```
<font size="1">極小</font>
<font size="2">小さい</font>
<font size="3">普通</font>
<font size="4">やや大きい</font>
<font size="5">大きい</font>
<font size="6">特大</font>
<font size="7">超特大</font>
```

| size | 実際のサイズ | 備考 |
|------|-------------|------|
| 1 | 0.625em | 10px相当 |
| 2 | 0.75em | 12px相当 |
| 3 | 1em | 16px相当（デフォルト） |
| 4 | 1.125em | 18px相当 |
| 5 | 1.25em | 20px相当 |
| 6 | 1.5em | 24px相当 |
| 7 | 2em | 32px相当（最大） |

**対応しない形式:**
- `size="100"` のような範囲外の数値 → 無視
- `size="+1"` のような相対指定 → 無視
- `size="2em"` のようなCSS単位 → 無視

### 複合指定

```
<font color="red" size="5">赤くて大きい</font>
```

## アライメント構文との併用

```
<< <font color="blue">左寄せで青い文字</font>
>> <font color="red" size="5">右寄せで赤くて大きい</font>
>< <font color="purple">センタリングで紫</font>
```

### 処理順序

```
content
  ↓ processAlignment()   ← アライメント（先）
  ↓ marked.parse()       ← Markdown
  ↓ processFontTags()    ← fontタグ変換（後）
  ↓ processImageUrls()   ← 画像
  ↓ sanitize()           ← サニタイズ（fontタグを許可リストに）
html
```

fontタグはMarkdown処理後に変換することで、Markdownの構文と干渉しない。

## 使用例

### 強調・整理

```
<font color="red" size="5">重要</font>: 締め切りは明日です。

<font color="blue">ポイント1:</font> まず準備をする
<font color="blue">ポイント2:</font> 次に実行する
<font color="blue">ポイント3:</font> 最後に確認する

<font color="gray" size="2">※ 詳細は後日追記予定</font>
```

### 長文の見出し・構成

```
>< <font color="navy" size="6">第一章 はじまり</font>

ここから本文が始まる。普通のテキストで書いていく。
途中で<font color="red">重要な部分</font>を強調したり、
<font color="green">キーワード</font>に色をつけたりする。

>< <font color="navy" size="5">1-1. 背景</font>

小見出しはやや小さめに。色を揃えて統一感を出す。

>> <font color="gray" size="2">— 続く</font>
```

### 会話の書き分け

```
<font color="red">太郎:</font>「おはよう」
<font color="blue">花子:</font>「おはよう。今日は早いね」
<font color="red">太郎:</font>「<font size="5">大事な話</font>があるんだ」
<font color="blue">花子:</font>「<font size="2">...なに?</font>」
```

### 引用・注釈

```
本文はこのように書く。

<font color="gray" size="2">
引用元: 〇〇より
補足: この部分は後から追加した内容です
</font>
```

## 実装

### パーサー

```typescript
const FONT_TAG_REGEX = /<font(\s+[^>]*)>(.*?)<\/font>/gi
const COLOR_ATTR_REGEX = /color=["']([^"']+)["']/i
const SIZE_ATTR_REGEX = /size=["']([1-7])["']/i

const SIZE_MAP: Record<string, string> = {
  '1': '0.625em',
  '2': '0.75em',
  '3': '1em',
  '4': '1.125em',
  '5': '1.25em',
  '6': '1.5em',
  '7': '2em',
}

// 許可する色名
const ALLOWED_COLORS = new Set([
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
  'cyan', 'magenta', 'lime', 'navy', 'teal', 'maroon',
  'white', 'black', 'gray', 'grey', 'silver',
])

function isValidColor(color: string): boolean {
  if (ALLOWED_COLORS.has(color.toLowerCase())) return true
  if (/^#[0-9A-Fa-f]{3,6}$/.test(color)) return true
  return false
}

function processFontTags(html: string): string {
  return html.replace(FONT_TAG_REGEX, (match, attrs, content) => {
    const styles: string[] = []

    const colorMatch = attrs.match(COLOR_ATTR_REGEX)
    if (colorMatch && isValidColor(colorMatch[1])) {
      styles.push(`color: ${colorMatch[1]}`)
    }

    const sizeMatch = attrs.match(SIZE_ATTR_REGEX)
    if (sizeMatch && SIZE_MAP[sizeMatch[1]]) {
      styles.push(`font-size: ${SIZE_MAP[sizeMatch[1]]}`)
    }

    if (styles.length === 0) return content

    return `<span style="${styles.join('; ')}">${content}</span>`
  })
}
```

### サニタイズ設定

DOMPurifyなどを使う場合、`<span style="...">` を許可:

```typescript
const ALLOWED_STYLE_PROPS = ['color', 'font-size']

DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (data.attrName === 'style') {
    // color と font-size のみ許可
    const filtered = data.attrValue
      .split(';')
      .filter(prop => {
        const name = prop.split(':')[0]?.trim()
        return ALLOWED_STYLE_PROPS.includes(name)
      })
      .join('; ')
    data.attrValue = filtered
  }
})
```

## 互換性

### 他のNostrクライアント

- HTMLをサポートするクライアント → そのまま表示される可能性あり
- HTMLを無視するクライアント → タグが除去されてテキストのみ表示
- いずれにせよ内容は伝わる

## 対応しない属性

以下は昔のfontタグにあったが、対応しない:
- `face` - フォント指定（一貫性のため）
- `+1`, `-1` などの相対サイズ指定
