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
  tags: [],
  content: JSON.stringify({ name, display_name, picture, about }),
  pubkey: "...",
  id: "...",
  sig: "..."
}
```
- プロフィール情報（名前など）を保存
- localStorage優先で読み込み、リレーはフォールバック

### kind:1 (Text Note)
```typescript
{
  kind: 1,
  created_at: timestamp,
  tags: [
    ['t', 'mypace'],       // ハッシュタグ (フィルタリング用)
    ['client', 'mypace']   // クライアント識別
  ],
  content: "Hello world",
  pubkey: "...",
  id: "...",
  sig: "..."
}
```
- `#mypace` タグで mypace からの投稿のみを表示
- 一般の Nostr 投稿は除外される

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
