# Nostr Integration

## Authentication

### Auto-generated Keys (Default)
- First visit: generate secret key via `crypto.getRandomValues()`
- Store in `localStorage` as hex
- No registration required

### NIP-07 (Browser Extension)
- If extension detected (nos2x, Alby, etc.), use it
- More secure: key never leaves extension
- User can export nsec from Settings to use extension

## Key Management

```typescript
// app/lib/nostr/keys.ts

getOrCreateSecretKey()  // Get or generate key
exportNsec(sk)          // Export as nsec1...
importNsec(nsec)        // Import nsec1...
hasNip07()              // Check extension
```

## Events

### kind:0 (Profile/Metadata)
```typescript
{
  kind: 0,
  created_at: timestamp,
  tags: [
    ['emoji', 'shortcode', 'https://example.com/emoji.png']  // NIP-30 カスタム絵文字
  ],
  content: JSON.stringify({ name, display_name, picture, about, nip05, lud16 }),
  pubkey: "...",
  id: "...",
  sig: "..."
}
```
- プロフィール情報（名前など）を保存
- localStorage優先で読み込み、リレーはフォールバック
- NIP-30: カスタム絵文字の定義（emojiタグ）
- NIP-05: ユーザー検証（nip05フィールド）

### kind:1 (Text Note)
```typescript
{
  kind: 1,
  created_at: timestamp,
  tags: [
    ['t', 'mypace'],       // ハッシュタグ (フィルタリング用)
    ['client', 'mypace'],  // クライアント識別
    ['emoji', 'shortcode', 'https://example.com/emoji.png']  // NIP-30 カスタム絵文字
  ],
  content: "Hello :shortcode: world",
  pubkey: "...",
  id: "...",
  sig: "..."
}
```
- `#mypace` タグで mypace からの投稿のみを表示
- 一般の Nostr 投稿は除外される
- NIP-30: コンテンツ内の `:shortcode:` は絵文字画像として表示

### kind:5 (Delete Request)
```typescript
{
  kind: 5,
  created_at: timestamp,
  tags: [['e', 'event_id_to_delete']],
  content: '',
  pubkey: "...",
  id: "...",
  sig: "..."
}
```
- 投稿の削除をリクエスト
- 編集時は delete + 新規投稿の2ステップ

### kind:6 (Repost / NIP-18)
```typescript
{
  kind: 6,
  created_at: timestamp,
  tags: [
    ['e', 'original_event_id', ''],
    ['p', 'original_author_pubkey']
  ],
  content: JSON.stringify(originalEvent),
  pubkey: "...",
  id: "...",
  sig: "..."
}
```
- 他ユーザーまたは自分の投稿をリポスト
- タイムラインでは「🔁 ○○ reposted」ラベル付きで表示

### kind:7 (Reaction / NIP-25)
```typescript
{
  kind: 7,
  created_at: timestamp,
  tags: [
    ['e', 'target_event_id'],
    ['p', 'target_author_pubkey']
  ],
  content: '+',
  pubkey: "...",
  id: "...",
  sig: "..."
}
```
- 投稿へのいいね（★）
- content `+` は一般的ないいねを表す
- 自分の投稿へのいいねは禁止（UI側で制御）

### kind:42000 (Sinov NPC Post)
```typescript
{
  kind: 42000,
  created_at: timestamp,
  tags: [
    ['t', 'mypace'],
    ['client', 'mypace']
  ],
  content: "NPC message",
  pubkey: "...",
  id: "...",
  sig: "..."
}
```
- Sinov NPCからの投稿（他のNostrクライアントには表示されない）
- mypaceフィルタがONの時のみ取得
- タイムラインでは「NPC」ラベル付きで表示
- 通常投稿・リプライ共にこのkindを使用

### Reply Tags (NIP-10)
返信時はkind:1イベントに追加タグを付与:
```typescript
tags: [
  ['t', 'mypace'],
  ['client', 'mypace'],
  ['e', 'root_event_id', '', 'root'],   // スレッドルート
  ['e', 'reply_to_id', '', 'reply'],    // 直接の返信先
  ['p', 'root_author_pubkey'],
  ['p', 'reply_author_pubkey']
]
```
- 編集時もe/pタグを保持してスレッド関係を維持

## Profile Management

- ローカルストレージ (`mypace_profile`) を最優先で読み込み
- 設定画面から名前を変更可能
- 変更はリレーに送信 + ローカル保存

## Relays

Default relays in `app/lib/nostr/relay.ts`:
```typescript
const RELAYS = [
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
]
```

## Filtering

タイムライン取得時に `#t: ['mypace']` フィルターを適用:
- `fetchEvents()` - クライアント直接取得
- `/api/timeline` - サーバーAPI経由

## Security

- Secret key NEVER sent to server
- Post signing happens client-side only
- localStorage key can be cleared anytime
- NIP-07 preferred for long-term use

## NIP-30: Custom Emojis

カスタム絵文字のサポート:

```typescript
// プロフィールや投稿のemojiタグから絵文字を取得
const emojis = event.tags
  .filter(t => t[0] === 'emoji' && t[1] && t[2])
  .map(t => ({ shortcode: t[1], url: t[2] }))

// コンテンツ内の :shortcode: を画像に変換
content.replace(/:([a-zA-Z0-9_]+):/g, (match, shortcode) => {
  const url = emojiMap.get(shortcode)
  return url ? `<img src="${url}" class="custom-emoji" />` : match
})
```

表示箇所:
- ユーザー名（EmojiTextコンポーネント）
- 投稿本文（content-parserで処理）
- 投稿プレビュー

## NIP-98: HTTP Auth

画像アップロード時の認証:

```typescript
// kind:27235 イベントを生成
{
  kind: 27235,
  created_at: timestamp,
  tags: [
    ['u', 'https://nostr.build/upload'],
    ['method', 'POST']
  ],
  content: '',
  pubkey: "...",
  id: "...",
  sig: "..."
}
```

- nostr.build へのアップロードで使用
- Authorization ヘッダーに base64 エンコードして送信

## NIP-05: Identifier Verification

ユーザー検証（例: user@domain.com）:

```typescript
// プロフィールの nip05 フィールドから取得
const nip05 = profile.nip05  // "user@domain.com"

// APIで検証
// GET https://domain.com/.well-known/nostr.json?name=user
// 返されたpubkeyとプロフィールのpubkeyが一致すれば検証済み
```

- プロフィールページでチェックマーク表示
- キャッシュして再検証の負荷を軽減

## NIP-45: Event Counts

ユーザーの投稿数を取得するために NIP-45 COUNT を使用:

```typescript
// WebSocket で COUNT リクエストを送信
ws.send(JSON.stringify(['COUNT', subId, {
  kinds: [1, 30023],  // kind:1 (Text Note) + kind:30023 (Long-form)
  authors: [pubkey]
}]))

// リレーからの応答
// ['COUNT', subId, { count: 123 }]
```

- `relay.nostr.band` が NIP-45 をサポート
- プロフィールページで総投稿数を表示
- フィルタ状態に関係なく、常にユーザーの総投稿数を取得

## NIP-19: Bech32 Entity Encoding

投稿内の `nostr:` URIをパースしてリンク表示:

| URI形式 | 表示 | リンク先 |
|---------|------|----------|
| `nostr:npub1...` | `@ユーザー名` | プロフィールページ |
| `nostr:nprofile1...` | `@ユーザー名` | プロフィールページ |
| `nostr:note1...` | `📝 note` | 投稿ページ |
| `nostr:nevent1...` | `📝 note` | 投稿ページ |

```typescript
// content-parser.tsx でパース
const NOSTR_URI_REGEX = /nostr:(npub1|nprofile1|note1|nevent1)[a-zA-Z0-9]+/g

// nip19.decode() でデコード
const decoded = nip19.decode(encoded)
// decoded.type: 'npub' | 'nprofile' | 'note' | 'nevent'
// decoded.data: pubkey | { pubkey, relays } | noteId | { id, relays }
```

- プロフィールが取得済みの場合はユーザー名を表示
- 未取得の場合は短縮形式（`@npub1abc...`）を表示
- クリックでプロフィールページまたは投稿ページに遷移
