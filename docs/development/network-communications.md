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
  │ [API 0-2] extractNouns + fetchWordrotInventory ... Wordrot               │
  │           ※ extractNouns: バッチ抽出済みならクライアントキャッシュHit(0回) │
  │           ※ inventory: TTL 60秒以内ならクライアントキャッシュHit(0回)     │
  │ [リレー]  fetchEventsByIds([親ID])             ... 親イベント取得         │
  └─────────────────────────────────────────────────┘
  │  ※ superMentionsキャッシュ済みならAPI呼び出し0回
  │  ※ キャッシュ無しなら [API] POST /api/events/enrich (スーパーメンションのみ)
  │
  ▼ 全pubkeyをバッチ収集 → 1回でfetchProfiles
  [リレー] fetchProfiles([著者, リプライ者, リアクター, 親著者])
  │
  └─ [API]  POST /api/views/impressions (fire-and-forget)
```

**合計**: リレー2回 + API 0-3回（キャッシュHit時は0回）

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
  │  ※ TTL 60秒以内ならクライアントキャッシュHit(0回)
  │
  ▼ checkSupernovas (順次 - DB書き込みを含むため順序保証が必要)
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

**合計**: API 6-7回（check順次 + 5並列） ← 改善: inventoryキャッシュ

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
| `/api/uploads/{pubkey}` | `fetchUploadHistory` | UploadHistoryPage |
| `/api/pins/{pubkey}` | `fetchPinnedPost` | UserView |
| `/api/serial/{pubkey}` | `fetchUserSerial` | UserView |
| `/api/push/vapid-public-key` | (直接fetch) | usePushNotifications |
| `/api/push/status` | (直接fetch) | usePushNotifications |
| `/api/sticker/history` | `getStickerHistory` | StickerPicker |
| `/api/super-mention/suggest` | `getSuperMentionSuggestions` | SuperMentionPopup |
| `/api/tweet/{tweetId}` | (直接fetch) | TwitterEmbed |
| `/api/npc/reporter` | `createReporterQuote` | ReporterIntentPage |

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

### ✅ 解決済み: `fetchWordrotInventory` の重複呼び出し

```
タイムライン表示                      投稿詳細
  useWordrotTimeline                   usePostViewData
    └─ fetchWordrotInventory(pk)         └─ fetchWordrotInventory(pk)
       API 1回                              クライアントキャッシュHit (0回)
```

**対策**: `fetchWordrotInventory` にTTL 60秒のクライアントキャッシュを追加。
`collectWord` 成功時はレスポンスに含まれるinventoryでキャッシュを直接更新。
`synthesizeWords` 成功時はキャッシュを無効化。

---

### ✅ 改善済み: インベントリページのAPI呼び出し

```
ページロード
  [1] fetchWordrotInventory (useWordrotマウント、キャッシュHit時0回)
  [2] checkSupernovas (順次 - DB書き込みを含むため並列化不可)
  [3-7] Promise.all (5並列):
    fetchStellaBalance
    fetchUserSupernovas
    fetchSupernovaDefinitions
    fetchUserStellaStats
    fetchUserStats
```

**対策**:
1. `fetchWordrotInventory` のキャッシュで遷移時は0回に
2. `checkSupernovas` はDB書き込み→読み取りの順序保証が必要なため順次のまま
3. 残: API統合エンドポイント `GET /api/inventory/full` で 5→1 削減は将来課題

---

### ✅ 解決済み: `extractNouns` のクライアントキャッシュ統一

```
api.ts:           extractNounsCache (モジュールMap) ← eventIDベースでキャッシュ
extractNounsBatch: バッチ結果を extractNounsCache に反映 ← タイムライン→詳細の重複回避
useWordrot.ts:    extractedWordsCache ← 既存のhookレベルキャッシュも併存
```

**対策**: `extractNouns` 関数自体にクライアントキャッシュを追加（api.ts内）。
`extractNounsBatch` の結果も個別キャッシュに反映し、タイムライン→投稿詳細遷移時の再取得を回避。

---

### ✅ 解決済み: `collectWord` 後のインベントリ全取得

```
collectWord(word) → 成功 → レスポンスにinventory含む → 直接state更新
```

**対策**: `POST /api/wordrot/collect` のレスポンスに更新後インベントリを含めるようAPI変更。
クライアント側は `loadInventory()` の再呼び出しを廃止し、レスポンスデータで直接更新。

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

### 実施済みの最適化

| 課題 | 対策 | 効果 |
|---|---|---|
| Wordrotインベントリ重複取得 | `fetchWordrotInventory` にTTL 60sクライアントキャッシュ | ページ遷移時API 0回 |
| extractNouns キャッシュ未共有 | `extractNouns`/`extractNounsBatch` にapi.tsレベルでキャッシュ統一 | タイムライン→詳細遷移時API 0回 |
| collectWord → inventory全取得 | APIレスポンスにinventory含める | collect後のAPI 1回→0回 |
| InventoryPage checkSupernovas | DB書き込み→読み取り順序保証のため順次維持 | 正確性を優先 |
| synthesizeWords後のキャッシュ | 合成成功時にinventoryキャッシュ無効化 | 次回fetchで最新取得 |

### バッチ化すべき残課題

| 課題 | 現状 | 理想 |
|---|---|---|
| インベントリページ | 6 API (全並列) | 1-2 API (統合エンドポイント `GET /api/inventory/full`) |
