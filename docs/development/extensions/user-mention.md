# ユーザーメンション（@username）

投稿内の `@username` 形式をクリック可能なリンクとして表示する機能。

## 概要

| 項目 | 内容 |
|------|------|
| 形式 | `@username` |
| 解決方法 | フェッチ済みprofilesからname/display_nameで検索 |
| 表示 | 太字の白文字リンク（スーパーメンションと同様） |
| クリック | ユーザーページへ遷移 |

## 仕様

### パターンマッチ

```regex
@([a-zA-Z0-9_]+)
```

- `@alice` → profilesから `name` または `display_name` が `alice` のユーザーを検索
- 大文字小文字を区別しない（case-insensitive）

### 解決フロー

1. 投稿コンテンツ内の `@username` パターンを検出
2. フェッチ済みの `profiles` マップから name/display_name で検索
3. 見つかった → `<a href="/user/{npub}">` リンクとして出力
4. 見つからない → 元のテキスト `@username` をそのまま出力（リンクにならない）

### スタイル

スーパーメンション（@@）と同様のスタイル:

- 太字（font-weight: 900）
- 白文字（#fff）
- 黒い縁取り（-webkit-text-stroke: 3px）
- ホバーで下線

```css
.content-user-mention {
  color: #fff;
  -webkit-text-fill-color: #fff;
  -webkit-text-stroke: 3px #000;
  paint-order: stroke fill;
  font-weight: 900;
  text-decoration: none;
}

.content-user-mention:hover {
  text-decoration: underline;
}
```

### 既存のnostr:形式との共存

| 形式 | 処理 |
|------|------|
| `nostr:npub1...` | 既存の処理（NIP-27） |
| `nostr:nprofile1...` | 既存の処理（NIP-27） |
| `@username` | 新規: profilesから検索 |

## 注意点

- 解決はパース時に同期的に行われる（非同期フェッチなし）
- profilesに存在しないユーザーはリンクにならない
- `@@` で始まる場合はスーパーメンションとして処理（こちらが優先）

## 他のNostrクライアントでの表示

`@username` はプレーンテキストとして表示される（Nostr標準ではないため）。

---

[← 拡張一覧に戻る](./index.md)
