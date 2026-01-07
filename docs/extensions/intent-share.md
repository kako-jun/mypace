# Intent Share (MY PACEでシェア)

外部サイトからMY PACEの投稿画面にテキストを渡す機能。

## Overview

XやFacebookの「シェア」ボタンと同様に、外部サイトから「MY PACEでシェア」リンクを設置できる。リンクをクリックするとMY PACEが開き、投稿エディタにテキストがセットされた状態になる。

## Intent URL

```
https://mypace.world/intent/post?text=シェアしたいテキスト
```

### Parameters

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `text` | Yes | 投稿本文にセットするテキスト（URLエンコード必須） |

- URLを含めたい場合は`text`パラメータ内に含める
- 文字数が上限を超える場合は末尾をカット

## Usage

外部サイトがシェアボタンを設置する場合、`text`にページタイトルとURLを含める。

### HTML（静的）

```html
<a href="https://mypace.world/intent/post?text=記事タイトル%20https://example.com/article">
  MY PACEでシェア
</a>
```

### JavaScript（動的・推奨）

現在のページをシェアするボタン:

```javascript
function shareToMypace() {
  const text = `${document.title} ${location.href}`
  const url = `https://mypace.world/intent/post?text=${encodeURIComponent(text)}`
  window.open(url, '_blank')
}
```

```html
<button onclick="shareToMypace()">MY PACEでシェア</button>
```

### カスタムテキスト付き

```javascript
function shareToMypace(customText) {
  const text = customText
    ? `${customText} ${location.href}`
    : `${document.title} ${location.href}`
  const url = `https://mypace.world/intent/post?text=${encodeURIComponent(text)}`
  window.open(url, '_blank')
}

// 使用例
shareToMypace('この記事おすすめ！')
// → "この記事おすすめ！ https://example.com/article" が投稿欄にセットされる
```

## Behavior

1. Intent URLにアクセス
2. プロフィール未設定の場合 → ProfileSetupが表示される → 名前設定後に投稿エディタ
3. プロフィール設定済みの場合 → 投稿エディタに`text`の内容がセットされた状態で表示
4. ユーザーは内容を編集して投稿できる

## Implementation

### Routes

`/intent/post` を `HomePage` にマッピング:

```typescript
// App.tsx
<Route path="/intent/post" element={<HomePage />} />
```

### Query Parameter Handling

`HomePage` で `text` パラメータを処理:

```typescript
// HomePage.tsx
const shareText = searchParams.get('text')

if (shareText) {
  const truncated = shareText.length > LIMITS.MAX_POST_LENGTH
    ? shareText.slice(0, LIMITS.MAX_POST_LENGTH)
    : shareText
  setContent(truncated)
}
```

## Related

- [share.md](./share.md) - 投稿のシェアメニュー（投稿をURLやMarkdownでシェアする機能）
