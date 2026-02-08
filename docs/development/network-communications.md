# ブラウザ通信マップ

> ブラウザから発生する全ネットワーク通信の一覧。通信先・タイミング・まとめ方を網羅する。

---

## 通信先の全体像

```
Browser (React SPA)
  │
  ├──[WebSocket]── Nostr Relays (nos.lol, relay.damus.io)
  │                  querySync: タイムライン, プロフィール, メタデータ取得
  │                  publish:   投稿, リアクション, 削除
  │
  ├──[HTTPS]────── Cloudflare Workers API (api.mypace.llll-ll.com)
  │                  D1: views, stella, wordrot, 通知, supernova
  │                  外部: OGP取得, Wikidata検索, NPC/Reporter
  │
  ├──[HTTPS]────── nostr.build (画像アップロード)
  │
  └──[HTTPS]────── 外部サービス
                     nominatim.openstreetmap.org (位置検索)
                     api.nostalgic.llll-ll.com (訪問カウンター)
                     各ドメイン/.well-known/nostr.json (NIP-05検証)
```

---

## 1. ページ別通信フロー

### 1-1. タイムライン（初回ロード）

```
ブラウザ起動
  │
  ├─ [外部] GET api.nostalgic.llll-ll.com/visit   ... 訪問カウンタ (fire-and-forget)
  ├─ [API]  GET /api/notifications/unread-count    ... 未読通知チェック
  │
  ▼ タイムライン取得
  [リレー] querySync kinds:[1,6,30023,42000] limit:50
  │
  ▼ エンリッチメント一括取得 (fetchEventsEnrich → Promise.all)
  ┌─────────────────────────────────────────────────┐
  │ [リレー] fetchEventMetadata(50件分)  ... リアクション/リプライ/リポスト   │
  │ [リレー] fetchProfiles(著者pubkeys)  ... 著者プロフィール               │
  │ [API]   POST /api/events/enrich      ... views + スーパーメンション     │
  └─────────────────────────────────────────────────┘
  │
  ├─ [API]  POST /api/ogp/by-urls        ... OGP一括取得 (fire-and-forget)
  ├─ [API]  POST /api/views/impressions   ... インプレッション記録 (fire-and-forget)
  └─ [リレー] fetchProfiles(リアクター)   ... リアクタープロフィール (fire-and-forget)
```

**合計**: リレー3回 + API3回（並列） + fire-and-forget 3回

### 1-2. タイムライン（スクロール / 過去ロード）

```
スクロール到達
  │
  [リレー] querySync until:searchedUntil limit:50
  │
  ▼ エンリッチメント一括取得 (上記と同構造)
  ┌─────────────────────────────────────────────────┐
  │ [リレー] fetchEventMetadata(新規分)                                    │
  │ [リレー] fetchProfiles(未知pubkeysのみ ← profilesRefで既知を除外)      │
  │ [API]   POST /api/events/enrich                                       │
  └─────────────────────────────────────────────────┘
  │
  ├─ [API]  OGP, impressions (fire-and-forget)
  └─ [リレー] リアクタープロフィール (fire-and-forget)
```

### 1-3. タイムライン（ポーリング / 60秒間隔）

```
60秒タイマー
  │
  [リレー] querySync since:latestEventTime limit:50
  │
  ▼ 新着があれば pendingNewEvents に蓄積
  ▼ ユーザーが「新着表示」ボタンを押したら:
  │
  ▼ エンリッチメント一括取得 (profilesで既知を除外)
  ┌─────────────────────────────────────────────────┐
  │ [リレー] fetchEventMetadata                                            │
  │ [リレー] fetchProfiles(未知のみ)                                       │
  │ [API]   POST /api/events/enrich                                       │
  └─────────────────────────────────────────────────┘
  │
  ├─ [API]  OGP, impressions (fire-and-forget)
  └─ [リレー] リアクタープロフィール (fire-and-forget)
```

### 1-4. 投稿詳細（タイムラインからの遷移 = キャッシュあり）

```
タイムラインカードのクリック
  │
  ▼ sessionStorageからキャッシュ復元
  │  event, profile, reactions, replies, reposts, views, superMentions
  │
  ▼ Promise.all:
  ┌─────────────────────────────────────────────────┐
  │ [API×2] extractNouns + fetchWordrotInventory ... Wordrot (直列)         │
  │ [リレー] fetchEventsByIds([親ID])             ... 親イベント取得        │
  └─────────────────────────────────────────────────┘
  │  ※ superMentionsキャッシュ済みならAPI呼び出し0回
  │  ※ キャッシュ無しなら [API] POST /api/events/enrich (スーパーメンションのみ)
  │
  ▼ 全pubkeyをバッチ収集 → 1回でfetchProfiles
  [リレー] fetchProfiles([著者, リプライ者, リアクター, 親著者])
  │
  └─ [API]  POST /api/views/impressions (fire-and-forget)
```

**合計**: リレー2回 + API 2-3回

### 1-5. 投稿詳細（直接URLアクセス = キャッシュなし）

```
URLアクセス
  │
  [リレー] fetchEventById(eventId)
  │
  ▼ Promise.all:
  ┌─────────────────────────────────────────────────┐
  │ [リレー] fetchEventMetadata([eventId])                                 │
  │ [API]   POST /api/events/enrich (views + スーパーメンション)           │
  │ [リレー] fetchEventsByIds([親ID])              ... 親イベント取得       │
  └─────────────────────────────────────────────────┘
  │
  ▼ Wordrot (fire-and-forget):
  [API×2] extractNouns → fetchWordrotInventory
  │
  ▼ 全pubkeyバッチ:
  [リレー] fetchProfiles([全pubkeys])
  │
  └─ [API] impressions (fire-and-forget)
```

**合計**: リレー4回 + API 3回 + fire-and-forget 1回

### 1-6. マガジンビュー

```
マガジンURL
  │
  ▼ Promise.all:
  ┌─────────────────────────────────────────────────┐
  │ [リレー] fetchMagazineBySlug(pubkey, slug)                             │
  │ [リレー] fetchUserProfile(pubkey)  → profiles stateにpre-seed          │
  │ getCurrentPubkey()                                                     │
  └─────────────────────────────────────────────────┘
  │
  [リレー] fetchEventsByIds(eventIds)
  │
  ▼ loadEnrichForEvents (pre-seed済みの著者pubkeyはスキップ)
  ┌─────────────────────────────────────────────────┐
  │ [リレー] fetchEventMetadata                                            │
  │ [リレー] fetchProfiles(著者のみ、magazine著者は除外)                   │
  │ [API]   POST /api/events/enrich                                       │
  └─────────────────────────────────────────────────┘
  │
  ├─ [API]  OGP (fire-and-forget)
  ├─ [リレー] リアクタープロフィール (fire-and-forget)
  └─ [API]  POST /api/magazine/views (fire-and-forget)
```

**合計**: リレー5回 + API 2回 + fire-and-forget 3回

### 1-7. インベントリページ

```
ページロード
  │
  ▼ useWordrot: fetchWordrotInventory (hook mount)
  [API] GET /api/wordrot/inventory/{pubkey}
  │
  ▼ checkSupernovas (順次)
  [API] POST /api/supernovas/check
  │
  ▼ Promise.all (5並列):
  ┌─────────────────────────────────────────────────┐
  │ [API] GET /api/stella-balance/{pubkey}                                 │
  │ [API] GET /api/supernovas/{pubkey}                                     │
  │ [API] GET /api/supernovas/definitions                                  │
  │ [API] GET /api/supernovas/stats/{pubkey}                               │
  │ [API] GET /api/user/{pubkey}/stats                                     │
  └─────────────────────────────────────────────────┘
```

**合計**: API 7回（うち5回並列） 🔴 高負荷

### 1-8. 通知パネル

```
パネルオープン
  │
  [API] GET /api/notifications?pubkey={pubkey}
  │
  ▼ Promise.all:
  ┌─────────────────────────────────────────────────┐
  │ [リレー] fetchProfiles(通知元pubkeys)                                  │
  │ [リレー] fetchEventsByIds(関連eventIds)                                │
  └─────────────────────────────────────────────────┘
```

---

## 2. Workers API エンドポイント一覧

### 読み取り系 (GET)

| エンドポイント | 関数名 | 呼び出し元 |
|---|---|---|
| `/api/user/{pubkey}/stats` | `fetchUserStats` | useMyStats, UserView, InventoryPage |
| `/api/notifications` | `fetchNotifications` | NotificationPanel |
| `/api/notifications/unread-count` | `checkUnreadNotifications` | Layout (定期) |
| `/api/stella-balance/{pubkey}` | `fetchStellaBalance` | StellaColorPicker, InventoryPage, useTimeline |
| `/api/supernovas/definitions` | `fetchSupernovaDefinitions` | InventoryPage |
| `/api/supernovas/{pubkey}` | `fetchUserSupernovas` | InventoryPage |
| `/api/supernovas/stats/{pubkey}` | `fetchUserStellaStats` | InventoryPage |
| `/api/wordrot/inventory/{pubkey}` | `fetchWordrotInventory` | useWordrot, useWordrotTimeline, usePostViewData |
| `/api/wordrot/word/{text}` | `fetchWordDetails` | WordDetailPage |
| `/api/wordrot/leaderboard` | `fetchWordrotLeaderboard` | LeaderboardPage |
| `/api/uploads/{pubkey}` | `fetchUploadHistory` | UploadHistoryPage |
| `/api/pins/{pubkey}` | `fetchPinnedPost` | UserView |
| `/api/serial/{pubkey}` | `fetchUserSerial` | UserView |
| `/api/push/vapid-public-key` | (直接fetch) | usePushNotifications |
| `/api/push/status` | (直接fetch) | usePushNotifications |
| `/api/sticker/history` | `getStickerHistory` | StickerPicker |
| `/api/super-mention/suggest` | `getSuperMentionSuggestions` | SuperMentionPopup |
| `/api/tweet/{tweetId}` | (直接fetch) | TwitterEmbed |
| `/api/npc/reporter` | `getReporterQuote` | ReporterIntentPage |

### 書き込み系 (POST/PUT/DELETE)

| エンドポイント | 関数名 | トリガー |
|---|---|---|
| `POST /api/events/enrich` | `fetchViewsAndSuperMentions` | タイムライン/投稿詳細/エンリッチ |
| `POST /api/ogp/by-urls` | `fetchOgpByUrls` | タイムライン/LinkPreview |
| `POST /api/views/impressions` | `recordImpressions` | タイムライン/投稿詳細 (fire-and-forget) |
| `POST /api/publish` | `recordEvent` | publishEvent後の自動記録 |
| `POST /api/wordrot/extract` | `extractNouns` | 投稿詳細 |
| `POST /api/wordrot/extract-batch` | `extractNounsBatch` | WordrotTimeline |
| `POST /api/wordrot/collect` | `collectWord` | ユーザー操作 |
| `POST /api/wordrot/synthesize` | `synthesizeWords` | ユーザー操作 |
| `POST /api/stella-balance/send` | `sendStella` | ステラ送信 |
| `POST /api/supernovas/check` | `checkSupernovas` | HomePage, InventoryPage |
| `POST /api/notifications/read` | `markNotificationsRead` | ユーザー操作 |
| `POST /api/npc/reporter` | `createReporterQuote` | ユーザー操作 |
| `POST /api/wikidata/search` | `searchWikidata` | SuperMentionPopup |
| `POST /api/super-mention/paths` | `saveSuperMentionPath` | スーパーメンション投稿時 |
| `POST /api/push/subscribe` | (直接fetch) | ユーザー操作 |
| `PUT /api/push/preference` | (直接fetch) | ユーザー操作 |
| `POST /api/sticker/save` | `saveStickerToHistory` | ステッカー使用時 |
| `POST /api/pins` | `setPinnedPost` | ユーザー操作 |
| `POST /api/uploads` | `saveUploadToHistory` | アップロード完了時 |
| `POST /api/magazine/views` | (直接fetch) | マガジンビュー |
| `DELETE /api/pins/{pubkey}` | `unpinPost` | ユーザー操作 |
| `DELETE /api/uploads` | `deleteUploadFromHistory` | ユーザー操作 |
| `DELETE /api/push/unsubscribe` | (直接fetch) | ユーザー操作 |
| `DELETE /api/super-mention/delete` | `deleteSuperMentionPath` | ユーザー操作 |
| `DELETE /api/sticker/delete` | `deleteStickerFromHistory` | ユーザー操作 |

---

## 3. Nostrリレー通信一覧

| 関数名 | Filter | リレー | 用途 |
|---|---|---|---|
| `fetchTimeline` | kinds:[1,6,30023,42000] + tags/search | GENERAL or SEARCH | タイムライン取得 |
| `fetchUserEvents` | authors:[pk], kinds:[1,6,30023,42000] | GENERAL or SEARCH | ユーザー投稿取得 |
| `fetchProfiles` | kinds:[0], authors:[pks] | GENERAL | プロフィール取得 |
| `fetchEventById` | ids:[id] | GENERAL | 単一イベント取得 |
| `fetchEventsByIds` | ids:[ids] | GENERAL | 複数イベント取得 |
| `fetchEventMetadata` | kinds:[7,1,6], #e:[ids] | GENERAL | リアクション/リプライ/リポスト |
| `fetchUserMagazines` | kinds:[30023], authors:[pk], #t:['magazine'] | GENERAL | マガジン一覧 |
| `fetchMagazineBySlug` | kinds:[30023], authors:[pk], #d:[slug] | GENERAL | マガジン取得 |
| `publishEvent` | — | RELAYS (publish) | イベント公開 |

---

## 4. 高負荷箇所の分析

### 🔴 高負荷: `fetchWordrotInventory` の重複呼び出し

```
タイムライン表示                      投稿詳細
  useWordrotTimeline                   usePostViewData
    └─ fetchWordrotInventory(pk) ──→     └─ fetchWordrotInventory(pk)
       API 1回                              API 1回 (同じデータ)
```

**問題**: 同じユーザーのインベントリがページ遷移のたびに再取得される。
セッション中にインベントリが変わるのは `collectWord` 実行時のみ。

**改善案**: `fetchWordrotInventory` にモジュールレベルのクライアントキャッシュ（TTL: 60秒）を追加。`collectWord` 成功時にキャッシュを無効化。

---

### 🔴 高負荷: インベントリページのAPI 7連射

```
ページロード
  [1] fetchWordrotInventory (useWordrotマウント)
  [2] checkSupernovas (順次)
  [3-7] Promise.all:
    fetchStellaBalance
    fetchUserSupernovas
    fetchSupernovaDefinitions
    fetchUserStellaStats
    fetchUserStats
```

**問題**: 7 API呼び出し。うち `checkSupernovas` は `Promise.all` の前に順次実行されている。

**改善案**:
1. `checkSupernovas` を `Promise.all` に含める（順次→並列化）
2. API統合エンドポイント `GET /api/inventory/full` で 5→1 に削減
3. `fetchWordrotInventory` のキャッシュで +1 削減

---

### 🟡 中負荷: `extractNouns` のクライアントキャッシュ未共有

```
useWordrot.ts:    extractedWordsCache (モジュールMap) ← キャッシュあり
usePostViewData:  extractNouns を直接呼び出し         ← キャッシュなし
```

**問題**: `useWordrot` にはイベントIDベースのキャッシュがあるが、`usePostViewData` は同じ関数を使わずAPIを直接呼ぶ。
サーバー側でもキャッシュしているが、ネットワーク往復は発生する。

**改善案**: `extractNouns` 関数自体にクライアントキャッシュを追加（api.ts内）。

---

### 🟡 中負荷: `collectWord` 後のインベントリ全取得

```
collectWord(word) → 成功 → loadInventory() → fetchWordrotInventory(全件取得)
```

**問題**: 1語コレクト後に全インベントリを再取得。

**改善案**: `collectWord` APIレスポンスに更新後インベントリを含める。

---

### 🟢 低負荷（許容範囲）

| 項目 | 理由 |
|---|---|
| ポーリング (60秒) | リレー1回/分。許容範囲 |
| OGP一括取得 | バッチ化済み。fire-and-forget |
| インプレッション記録 | バッチ化済み。fire-and-forget |
| リアクタープロフィール | fire-and-forget。表示遅延は許容 |
| プッシュ通知API | ユーザー操作時のみ |
| 画像アップロード | ユーザー操作時のみ。外部サービス |

---

## 5. 通信バッチ化の方針

### 現在のバッチ化パターン

| パターン | 例 |
|---|---|
| 配列で一括取得 | `fetchProfiles([pk1, pk2, ...])` で50件分を1回 |
| Promise.all並列 | metadata + profiles + views を同時取得 |
| fire-and-forget | OGP, impressions はawaitせず非同期 |
| キャッシュスキップ | `currentProfiles` で既知pubkeyをリレークエリから除外 |
| sessionStorageキャッシュ | タイムライン→詳細でevent, profile, metadata, superMentionsを引き継ぎ |

### バッチ化すべき残課題

| 課題 | 現状 | 理想 |
|---|---|---|
| インベントリページ | 7 API (うち2順次 + 5並列) | 1-2 API (統合エンドポイント) |
| Wordrotインベントリ | ページ遷移毎に再取得 | クライアントキャッシュ (TTL: 60s) |
| extractNouns | 呼び出し元ごとにキャッシュ有無が異なる | API関数レベルでキャッシュ統一 |
| collectWord → inventory | 全件再取得 | レスポンスに含める |
