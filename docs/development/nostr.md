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

- ローカルストレージ (`mypace` キー内の `cache.profile`) を最優先で読み込み
- 設定画面から名前を変更可能
- 変更はリレーに送信 + ローカル保存

## Relays

### 用途別リレー構成

```typescript
// タイムライン/検索用リレー（#t + NIP-50 search対応）
// relay.nostr.bandは全機能対応だが502エラーのため除外（復旧後に追加検討）
export const SEARCH_RELAYS = ['wss://search.nos.today']

// メタデータ/プロフィール用リレー（#e, authors対応）
export const GENERAL_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol']
```

### 用途別リレー使い分け

| 関数 | リレー | 理由 |
|------|--------|------|
| fetchTimeline | SEARCH_RELAYS | #t + NIP-50検索が必要 |
| fetchUserEvents | SEARCH_RELAYS | #t + NIP-50検索が必要 |
| fetchProfiles | GENERAL_RELAYS | authorsフィルタ対応 |
| fetchEventById | GENERAL_RELAYS | idsフィルタ対応 |
| fetchEventsByIds | GENERAL_RELAYS | idsフィルタ対応 |
| fetchEventMetadata | GENERAL_RELAYS | #eフィルタ対応（リアクション/リプライ/リポスト取得） |
| publishEvent | RELAYS（両方） | 全リレーに投稿を配信 |

### リレー対応状況（2026年1月調査）

| リレー | #t | authors | search | #e | 備考 |
|--------|-----|---------|--------|-----|------|
| search.nos.today | ⚠️ | ⚠️ | ✅ | ❌(0件) | タイムライン/検索用。**authors があると #t を無視**（詳細は下記） |
| relay.nostr.band | ✅ | ✅ | ✅ | ✅ | 全機能対応だが502エラー（復旧待ち） |
| nostr.wine | ❌無視 | ✅ | ✅ | - | #tを送っても一般投稿を返す |
| relay.damus.io | ✅ | ✅ | ❌エラー | ✅ | メタデータ用（NIP-50非対応） |
| nos.lol | ✅ | ✅ | ❌エラー | ✅ | メタデータ用（NIP-50非対応） |

**search.nos.today の詳細な挙動**:
- `#t` 単体: ✅ 動作する
- `authors` 単体: ✅ 動作する
- `#t + search`: ✅ 動作する
- `authors + search`: ✅ 動作する
- `authors + #t`: ⚠️ **#t が無視される**（authors のみ適用）
- `authors + #t + search`: ⚠️ **#t が無視される**（authors + search のみ適用）

### 検索の方針

**タグ検索（okTags）とキーワード検索（queries）は常にリレー側で処理する。クライアント側フィルタには頼らない。**

理由:
- クライアント側フィルタを使うと、limitで取得した最新データの中からしかフィルタできない
- 過去のデータを検索できなくなる
- リレーが対応していない場合は機能制限として受け入れる

### 検索の重要な制約

**検索では絶対に SEARCH_RELAYS（NIP-50対応リレー）を使用すること**:
- 古い記事を検索するには NIP-50 の全文検索が必須
- GENERAL_RELAYS（damus, nos.lol）は NIP-50 非対応で検索できない
- 検索リレー以外を使うと、limit で取得した最新データの中からしかフィルタできない

**search.nos.today の挙動（重要）**:
- `authors` フィルタがある場合、`#t`（タグフィルタ）を**完全に無視**する
- キーワード検索（search パラメータ）の有無に関係なく、authors があれば #t は無視される
- つまり `authors + #t` や `authors + #t + search` の組み合わせでは、タグ絞り込みが効かない

**ユーザーページでの対応**:
- 上記の制約により、ユーザーページ（authors フィルタ必須）ではタグ検索を**無効化**している
- UI 上でタグ入力欄を非表示にし、URL の tags パラメータも無視する
- キーワード検索のみ有効（authors + search は正常に動作する）
- relay.nostr.band が復旧すれば全機能対応だが、現在 502 エラーで利用不可

### 調査履歴

**2026年1月20日（追加調査）**:
- search.nos.today の正確な挙動を確認：
  - `authors` フィルタがある場合、`#t` フィルタを完全に無視する
  - キーワード検索（search）の有無に関係なく、authors があれば #t は無視
  - `authors + search` は動作する、`#t + search` も動作する、しかし `authors + #t` は #t が無視される
- ユーザーページでタグ検索を無効化（TimelineSearch に disableTags プロパティ追加）

**2026年1月20日**:
- okTagsとqueriesをリレー側のみで処理する方針に変更
- クライアント側のfilterByOkTagsを削除
- search.nos.todayはauthorsを「0件」ではなく「無視」することを確認

**2026年1月（初期調査）**:
- relay.nostr.bandが502エラーを返し始める（原因・復旧時期不明）
- search.nos.todayが#eフィルタで0件を返すことを確認（メタデータ取得不可）
- 用途別にリレーを分離する構成に変更

## Filtering

### リレー側フィルタ（Nostrプロトコル）

| フィルタ | 説明 | 条件 |
|----------|------|------|
| kinds | イベントタイプ | 常に |
| #t | タグフィルタ (OR) | showAll=false: `['mypace', ...okTags]`、showAll=true: `okTags` |
| authors | 投稿者 | fetchUserEventsのみ |
| since, until | 時間範囲 | 指定時 |
| search | 全文検索 (NIP-50) | 検索キーワード（queries）あり時 |

### クライアント側フィルタ

| フィルタ | 説明 |
|----------|------|
| filterByMuteList | ミュートユーザー除外 |
| filterBySmartFilters | 広告タグ/キーワード、NSFWタグ/キーワード除外 |
| filterByNPC | NPC投稿(kind:42000)除外 |
| filterByNgWords | NGワード除外 |
| filterByNgTags | NGタグ除外（タグ配列+本文中の#tag） |
| filterByLanguage | 言語フィルタ |

**注意**: okTags（タグ検索）とqueries（キーワード検索）はリレー側で処理。クライアント側フィルタには含めない。

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

## ユーザー投稿数の取得

ユーザーの投稿数を取得するために [Primal](https://primal.net) のキャッシュサービスを使用:

```typescript
// Primal cache WebSocket API
ws.send(JSON.stringify(['REQ', 'stats', {
  cache: ['user_profile', { pubkey }]
}]))

// kind 10000105 イベントで統計を返す
// { note_count: 240, long_form_note_count: 0, ... }
```

### なぜ Primal を使用するか

NIP-45 (COUNT) は標準プロトコルだが、2026年1月時点で主要リレーがサポートしていない:

| リレー | NIP-45対応 |
|--------|-----------|
| relay.nostr.band | ❌ (502エラー) |
| relay.damus.io | ❌ ("unknown cmd") |
| nos.lol | ❌ ("unknown cmd") |
| nostr.wine | ❌ ("Invalid enum value") |
| purplepag.es | ✅ (ただしプロフィール専用、投稿データなし) |

Primalは全Nostrリレーからイベントを収集・集計し、`user_profile` エンドポイントで統計を提供:
- `note_count`: 短文投稿数
- `long_form_note_count`: 長文投稿数
- `followers_count`, `follows_count` など

**注意**: MYPACE独自のステラ（いいね）数はPrimalで取得不可。標準タグを使用していないため。

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
