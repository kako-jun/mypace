# アライメント構文計画

## 概要

Markdownにない左寄せ/右寄せ/センタリングを独自構文で実現する。
テキストだけでなく、画像やあらゆるコンテンツに適用可能。

## 構文

| 記法 | 意味 | CSS |
|------|------|-----|
| `<<` | 左寄せ（行頭に配置） | `text-align: left` |
| `>>` | 右寄せ（行末に配置） | `text-align: right` |
| `><` | センタリング | `text-align: center` |
| `<>` | 左右分割 | `justify-content: space-between` |

行頭にマーカーを置き、その行のコンテンツにアライメントを適用。

### 左右分割 `<>` の詳細

`|` で区切って左右に配置:

```
<> 左のテキスト | 右のテキスト
```

表示:
```
┌────────────────────────────────────┐
│ 左のテキスト          右のテキスト │
└────────────────────────────────────┘
```

## 使用例

### キャラ会話（LINE風）

```
<< https://example.com/charA.png
<< こんにちは
>> https://example.com/charB.png
>> やあ！
<< 元気？
>> うん！
```

**表示イメージ:**
```
┌─────────────┐
│ [画像A]      │
│ こんにちは   │
└─────────────┘
              ┌─────────────┐
              │    [画像B]  │
              │     やあ！  │
              └─────────────┘
```

### 告知（全センタリング）

```
>< 🎉 お知らせ 🎉
>< 明日イベントやります
>< https://example.com/event.jpg
>< 詳しくはこちら
```

### 画像だけの会話

```
<< https://example.com/reaction1.gif
>> https://example.com/reaction2.gif
<< https://example.com/reaction3.gif
```

### 署名・フッター

```
通常のテキストがここに...

>> — 名前
>> 2025年1月1日
```

### 左右分割の例

**対話形式:**
```
<> キャラA: やあ | キャラB: こんにちは
<> キャラA: 元気？ | キャラB: うん！
```

**価格表:**
```
<> りんご | ¥100
<> みかん | ¥80
<> ぶどう | ¥300
```

**日付付き:**
```
<> 今日のできごと | 2025/01/15
```

**タイトルと作者:**
```
<> 小説のタイトル | 著: 山田太郎
```

## 実装方針

### 処理タイミング

Markdown解析の**前**にアライメントマーカーを処理:

```
content
  ↓ processAlignment()  ← 追加
  ↓ marked.parse()
  ↓ processImageUrls()
  ↓ ...
html
```

### 変換ロジック

```typescript
function processAlignment(content: string): string {
  const lines = content.split('\n')
  return lines.map(line => {
    if (line.startsWith('<< ')) {
      return `<div class="align-left">${line.slice(3)}</div>`
    }
    if (line.startsWith('>> ')) {
      return `<div class="align-right">${line.slice(3)}</div>`
    }
    if (line.startsWith('>< ')) {
      return `<div class="align-center">${line.slice(3)}</div>`
    }
    return line
  }).join('\n')
}
```

### CSS

```css
.align-left {
  text-align: left;
}

.align-right {
  text-align: right;
}

.align-center {
  text-align: center;
}

/* 画像のアライメント */
.align-left img {
  display: block;
  margin-right: auto;
}

.align-right img {
  display: block;
  margin-left: auto;
}

.align-center img {
  display: block;
  margin: 0 auto;
}
```

## 注意点

- マーカーと内容の間にはスペースが必要: `<< テキスト`
- 行単位の適用（ブロックレベルではない）
- 通常のMarkdown記法と併用可能
- 他のNostrクライアントではマーカーがそのまま表示される（`<< こんにちは`）

## サンプル投稿: Vim風ウガンダメッセージ

センタリング機能のデモとして、Vim起動画面風の投稿を作成。

### 投稿内容

```
><
>< MYPACE - My Pace SNS
>< version 1.0
><
>< mypace is open source and freely distributable
><
>< Help mass adoption of Nostr!
>< type :zap<Enter>       for lightning tips
><
>< type :help<Enter>      for on-line help
>< type :q<Enter>         to quit (but why would you?)
><
```

### 表示イメージ

```
┌─ 投稿 ──────────────────────────────────────┐
│                                             │
│         MYPACE - My Pace SNS                │
│              version 1.0                    │
│                                             │
│   mypace is open source and freely          │
│              distributable                  │
│                                             │
│       Help mass adoption of Nostr!          │
│   type :zap<Enter>       for lightning tips │
│                                             │
│   type :help<Enter>      for on-line help   │
│   type :q<Enter>   to quit (but why would   │
│                            you?)            │
│                                             │
└─────────────────────────────────────────────┘
```

### 用途

- センタリング機能のデモ
- mypaceの遊び心を伝える
- Vimユーザーへの親しみ
- 初期投稿のサンプルとして公式アカウントから投稿

## 将来の拡張案

- 複数行ブロック対応（開始・終了マーカー）
- 吹き出しスタイルのオプション
- キャラ名の自動検出・色分け
