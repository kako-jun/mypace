# teaser（長文フォールド）

280文字を超える投稿を折りたたみ、他のNostrクライアントのタイムラインを圧迫しない仕組み。

## 背景

- SNSのタイムラインに長文が流れると迷惑になる
- しかし「じっくり書きたい」ニーズもある
- Kind 30023（長文記事）は対応クライアントが少ない

## 解決策

Kind 1のまま、本文を分割してタグに格納する。

## タグ形式

```json
["teaser", "<続きの本文>"]
```

## 投稿時の処理

280文字を超える場合:

```json
{
  "kind": 1,
  "content": "最初の280文字...\n\n...READ MORE → https://mypace.llll-ll.com/user/{npub}",
  "tags": [
    ["t", "mypace"],
    ["client", "mypace"],
    ["teaser", "281文字目以降の本文すべて"]
  ]
}
```

## 閾値

**280文字**（Twitter/X基準）

この値は以下で共通:
1. 投稿時のteaser分割
2. エディタの「折りたたまれます」警告
3. 他クライアント投稿のGUI側切り詰め

## 表示ロジック

### タイムライン

```typescript
if (hasTeaserTag(event)) {
  // contentをそのまま表示（既に280字+リンク）
} else if (content.length > 280) {
  // GUI側で切り詰め + READ MORE
} else {
  // そのまま表示
}
```

### 個別ページ

```typescript
if (hasTeaserTag(event)) {
  const teaserContent = getTeaserContent(event.tags)
  const baseContent = removeReadMoreLink(event.content)
  return baseContent + teaserContent  // 全文表示
} else {
  return event.content
}
```

## READ MOREリンク

リンク先はユーザーページ（`/user/{npub}`）。

**理由**: イベントIDは署名前に確定できない（ハッシュが内容に依存するため）。
プロフィールページからなら該当投稿を見つけられる。

## 他クライアントでの表示

- `content` 部分（280字+リンク）のみ表示される
- `teaser` タグは無視される
- READ MOREリンクをクリックするとMyPaceで全文を読める
