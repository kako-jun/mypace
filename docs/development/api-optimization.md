# API通信最適化リファクタリング仕様

## 背景

タイムライン表示時に過剰なAPIリクエストが発生し、Cloudflare Workers無料プランの制限に達して503エラーが発生していた。

---

## 現状の通信詳細

### タイムライン（50件表示）

| # | API | 回数 | 内容 |
|---|-----|------|------|
| 1 | `GET /api/timeline` | 1 | 投稿イベント配列 |
| 2 | `POST /api/profiles` | 1 | 投稿者プロフィール（バッチ済み） |
| 3 | `GET /api/reactions/:id` | **50** | 各投稿のステラ情報 |
| 4 | `GET /api/replies/:id` | **50** | 各投稿のリプライ一覧（カード表示用） |
| 5 | `GET /api/reposts/:id` | **50** | 各投稿のリポスト数 |
| 6 | `POST /api/views/batch` | 1 | インプレッション数（バッチ済み） |
| 7 | `POST /api/views/batch-record` | 1 | インプレッション記録 |
| 8 | `GET /api/user/:pubkey/count` | 1 | 右下スタッツ: 投稿数 |
| 9 | `GET /api/user/:pubkey/stella` | 1 | 右下スタッツ: ステラ数 |
| 10 | `GET /api/user/:pubkey/views` | 1 | 右下スタッツ: 閲覧数 |
| | **合計** | **157** | |

#### タイムラインで必要な情報

投稿カードには以下が表示される：
- 投稿本文・画像・日時
- 投稿者名・アバター（profiles）
- ステラ数・リアクター一覧（reactions）
- リプライカード一覧（replies.replies[]）← **countだけでは不十分、カード描画に必要**
- リポスト数（reposts）
- インプレッション数 detail/impression（views）
- リプライ先ユーザー名（投稿がリプライの場合、profilesに含まれる必要あり）

### 記事個別ページ（直接アクセス）

| # | API | 回数 | 内容 |
|---|-----|------|------|
| 1 | `GET /api/events/:id` | 1 | 記事イベント |
| 2 | `POST /api/profiles` | 1 | 投稿者プロフィール |
| 3 | `GET /api/reactions/:id` | 1 | ステラ情報 |
| 4 | `GET /api/replies/:id` | 1 | リプライ一覧 |
| 5 | `GET /api/reposts/:id` | 1 | リポスト数 |
| 6 | `GET /api/views/:id` | 1 | インプレッション数 |
| 7 | `POST /api/views/:id` | 1 | detail記録 |
| 8 | `POST /api/profiles` | **N** | リプライ投稿者・リアクターのプロフィール（**forループで個別取得！**） |
| 9 | `GET /api/events/:parentId` | 1 | リプライ元イベント（この記事がリプライの場合） |
| 10 | `POST /api/profiles` | 1 | リプライ元投稿者プロフィール |
| | **合計** | **9+N** | リプライ10件+リアクター5人なら**24回** |

#### 個別ページで必要な情報

- 記事本文・投稿者情報
- メタデータ（ステラ、リプライ、リポスト、インプレ）
- リプライ元カード（上部に表示）← **タイムラインで未取得の可能性高い**
- リプライカード一覧（下部に表示）
- リプライ投稿者・リアクターのプロフィール

### ユーザーページ

| # | API | 回数 | 内容 |
|---|-----|------|------|
| 1 | `GET /api/user/:pubkey/events` | 1 | ユーザー投稿一覧 |
| 2 | 以降タイムラインと同様 | ... | メタデータ・プロフィール等 |

### 投稿エディタ（リプライ時）

| # | API | 回数 | 内容 |
|---|-----|------|------|
| 1 | `POST /api/profiles` | 1 | リプライ先ユーザーのプロフィール（名前表示用） |

---

## 設計方針

### 原則

1. **通信回数削減が最優先**
2. **投稿カードにぶら下がる情報（兄弟）は1回で一括取得**
   - ステラ（MYPACE独自）
   - リプライ一覧（Nostr標準）
   - リポスト数（Nostr標準）
   - インプレッション（MYPACE独自）
3. **タイムラインから個別ページへの遷移時はローカルデータを再利用**
4. **profilesは既にバッチ対応済み、そのまま活用**
5. **互換性は不要、サーバー・クライアント同時リファクタリング**

---

## 最終的なAPI設計

### 読み取り系（投稿表示）

| API | 用途 | 状態 |
|-----|------|------|
| `GET /api/timeline` | タイムライン | 既存維持 |
| `GET /api/users/:pubkey/events` | ユーザー投稿一覧 | 既存維持 |
| `POST /api/events/batch` | 複数イベント一括取得 | **新規** |
| `POST /api/events/enrich` | メタデータ+プロフィール+super-mention一括取得 | **新規** |
| `POST /api/ogp/batch` | OGP一括取得 | **新規** |
| `GET /api/users/:pubkey/stats` | スタッツ一括取得 | **新規** |

### 書き込み系

| API | 用途 | 状態 |
|-----|------|------|
| `POST /api/publish` | 投稿 | 既存維持 |
| `POST /api/views/record` | 閲覧記録 | 改名（batch-record統合） |

### その他機能（変更なし）

| カテゴリ | API |
|---------|-----|
| wikidata | `GET /api/wikidata/search` |
| super-mention | `GET/POST/DELETE /api/super-mention/*` |
| sticker | `GET/POST/DELETE /api/sticker/*` |
| pins | `GET/POST/DELETE /api/pins/*` |
| serial | `GET /api/serial/:pubkey` |
| uploads | `GET/POST/DELETE /api/uploads/*` |

### 削除するAPI（13個）

| 削除API | 統合先 |
|---------|--------|
| `GET /api/events/:id` | `POST /api/events/batch` |
| `GET /api/reactions/:eventId` | `POST /api/events/enrich` |
| `GET /api/replies/:eventId` | `POST /api/events/enrich` |
| `GET /api/reposts/:eventId` | `POST /api/events/enrich` |
| `GET /api/views/:eventId` | `POST /api/events/enrich` |
| `POST /api/views/batch` | `POST /api/events/enrich` |
| `POST /api/profiles` | `POST /api/events/enrich` |
| `POST /api/super-mention/lookup` | `POST /api/events/enrich` |
| `GET /api/ogp` | `POST /api/ogp/batch` |
| `POST /api/views/:id` | `POST /api/views/record` |
| `GET /api/user/:pubkey/count` | `GET /api/users/:pubkey/stats` |
| `GET /api/user/:pubkey/stella` | `GET /api/users/:pubkey/stats` |
| `GET /api/user/:pubkey/views` | `GET /api/users/:pubkey/stats` |

---

## 新規APIエンドポイント詳細

### 1. POST `/api/events/batch`

複数イベントを一括取得する。

**Request:**
```json
{
  "eventIds": ["id1", "id2", ...]
}
```

**Response:**
```json
{
  "id1": { "id": "...", "pubkey": "...", "content": "...", "created_at": ..., "tags": [...], ... },
  "id2": { ... }
}
```

**用途:**
- 個別ページでメイン記事 + リプライ元を1回で取得
- 存在しないIDはレスポンスに含まれない

### 2. POST `/api/events/enrich`

複数イベントのメタデータ・プロフィール・super-mentionを一括取得する。

**Request:**
```json
{
  "eventIds": ["id1", "id2", ...],
  "viewerPubkey": "viewer_pubkey",
  "superMentionPaths": ["path1", "path2", ...]
}
```

**Response:**
```json
{
  "metadata": {
    "id1": {
      "reactions": {
        "count": 5,
        "myReaction": true,
        "myStella": 3,
        "myReactionId": "...",
        "reactors": [...]
      },
      "replies": {
        "count": 3,
        "replies": [{ "id": "...", "pubkey": "...", "content": "...", ... }, ...]
      },
      "reposts": {
        "count": 2,
        "myRepost": true
      },
      "views": {
        "detail": 10,
        "impression": 50
      }
    },
    "id2": { ... }
  },
  "profiles": {
    "pubkey1": { "name": "...", "picture": "...", "about": "...", ... },
    "pubkey2": { ... }
  },
  "superMentions": {
    "path1": "Q12345",
    "path2": "Q67890"
  }
}
```

**実装メモ:**
- Nostrクエリで `#e` タグに配列を渡して一括取得
- reactions: `pool.querySync(RELAYS, { kinds: [7], '#e': eventIds })`
- replies: `pool.querySync(RELAYS, { kinds: [1, 30023, 42000], '#e': eventIds })`
- reposts: `pool.querySync(RELAYS, { kinds: [6], '#e': eventIds })`
- views: D1から一括取得（既存のbatchロジック流用）
- profiles: 投稿者 + リアクター + リプライ投稿者のpubkeyを収集し一括取得
- superMentions: D1から一括lookup

### 3. GET `/api/users/:pubkey/stats`

ユーザースタッツを一括取得する（右下ウィジェット用）。

**Response:**
```json
{
  "postsCount": 42,
  "stellaCount": 128,
  "viewsCount": {
    "details": 500,
    "impressions": 2000
  }
}
```

### 4. POST `/api/views/record`

閲覧記録を一括登録する（旧 batch-record を統合）。

**Request:**
```json
{
  "events": [
    { "eventId": "id1", "authorPubkey": "..." },
    { "eventId": "id2", "authorPubkey": "..." }
  ],
  "type": "impression",
  "viewerPubkey": "..."
}
```

**Response:**
```json
{
  "success": true,
  "recorded": 50
}
```

### 5. POST `/api/ogp/batch`

複数URLのOGPを一括取得する。

**Request:**
```json
{
  "urls": ["https://example.com/page1", "https://example.com/page2", ...]
}
```

**Response:**
```json
{
  "https://example.com/page1": {
    "title": "Page Title",
    "description": "Page description...",
    "image": "https://example.com/image.jpg",
    "siteName": "Example Site"
  },
  "https://example.com/page2": { ... }
}
```

**実装メモ:**
- D1キャッシュを先に確認し、未キャッシュのURLのみ外部fetch
- 外部fetchは並列処理（Promise.all）
- 取得したOGPはD1に24時間キャッシュ
- 失敗したURLはレスポンスに含めない（または `null`）

---

## 改善後の通信パターン

### タイムライン（50件表示）

| # | API | 回数 | 内容 |
|---|-----|------|------|
| 1 | `GET /api/timeline` | 1 | 投稿イベント配列 |
| 2 | `POST /api/events/enrich` | 1 | **メタデータ+プロフィール+super-mention** |
| 3 | `POST /api/ogp/batch` | 1 | 全リンクのOGP |
| 4 | `POST /api/views/record` | 1 | インプレッション記録 |
| 5 | `GET /api/users/:pubkey/stats` | 1 | 右下スタッツ |
| | **合計** | **5** | |

### ユーザーページ（50件表示）

| # | API | 回数 | 内容 |
|---|-----|------|------|
| 1 | `GET /api/users/:pubkey/events` | 1 | ユーザー投稿配列 |
| 2 | `POST /api/events/enrich` | 1 | メタデータ+プロフィール+super-mention |
| 3 | `POST /api/ogp/batch` | 1 | 全リンクのOGP |
| 4 | `POST /api/views/record` | 1 | インプレッション記録 |
| | **合計** | **4** | |

### 記事個別ページ（直接アクセス）

| # | API | 回数 | 内容 |
|---|-----|------|------|
| 1 | `POST /api/events/batch` | 1 | メイン記事 + リプライ元 |
| 2 | `POST /api/events/enrich` | 1 | メタデータ+プロフィール+super-mention |
| 3 | `POST /api/ogp/batch` | 1 | 記事内リンクのOGP |
| 4 | `POST /api/views/record` | 1 | detail記録 |
| | **合計** | **4** | |

### 記事個別ページ（タイムラインから遷移）

| # | API | 回数 | 内容 |
|---|-----|------|------|
| 1 | - | 0 | state/contextの取得済みデータを再利用 |
| 2 | `POST /api/events/batch` | 0〜1 | リプライ元（未取得の場合のみ） |
| 3 | `POST /api/events/enrich` | 0〜1 | リプライ元のenrich（未取得の場合のみ） |
| 4 | `POST /api/views/record` | 1 | detail記録 |
| | **合計** | **1〜3** | 多くの場合は1回 |

**補足:** タイムラインではリプライ元イベント本文を取得していないため、リプライ投稿の個別ページを開く場合は追加取得が必要。ただし、多くの投稿はリプライではないため、平均的には1回で済む。

### 投稿エディタ（リプライ時）

| # | API | 回数 | 内容 |
|---|-----|------|------|
| 1 | `POST /api/events/enrich` | 1 | リプライ先のプロフィール |
| | **合計** | **1** | |

---

## リクエスト数の比較

| 画面 | 現状 | 改善後 | 削減率 |
|------|------|--------|--------|
| タイムライン（50件） | 157回+super-mention+OGP | **5回** | 97%+ |
| ユーザーページ（50件） | 157回+ | **4回** | 97%+ |
| 個別ページ（直接） | 24回+ | **4回** | 83%+ |
| 個別ページ（遷移） | 数回 | **1〜3回** | - |

---

## UXの考慮点：段階的描画

### 描画の順序

バッチ処理により全データが一度に返るが、ユーザーに違和感を与えないよう段階的に描画：

```
1. events取得完了
   → カードの枠・本文・投稿日時を描画
   → メタデータ部分はスケルトン or 「-」表示

2. metadata取得完了
   → ステラ数・リプライ数・リポスト数・インプレ数を反映
   → リプライカード一覧を描画
   （全カード一斉に数字が入る）

3. profiles取得完了
   → npub → ユーザー名・アバターに置き換え
```

### 現状との違い

| 項目 | 現状 | 改善後 |
|------|------|--------|
| メタデータ表示 | カードごとにバラバラのタイミング | 全カード一斉 |
| 体感 | 徐々に埋まる（チラつきあり） | 枠 → 一気に数字 → 名前（明確な完了感） |

一斉表示の方が「読み込み完了」が明確で、チラつきが減る利点がある。

---

## 実装タスク

### API側（apps/api）

- [x] `POST /api/events/batch` 新規作成
- [x] `POST /api/events/enrich` 新規作成（metadata + profiles + super-mention統合）
- [x] `POST /api/ogp/batch` 新規作成
- [x] `GET /api/users/:pubkey/stats` 新規作成
- [x] `POST /api/views/record` 作成（batch-record統合）
- [x] 削除対象のエンドポイントを削除（profiles, ogp GET）

### フロントエンド側（apps/web）

- [x] `fetchEventsBatch(eventIds[])` API関数作成
- [x] `fetchEventsEnrich(eventIds[], authorPubkeys[], viewerPubkey, superMentionPaths[])` API関数作成
- [x] `fetchOgpBatch(urls[])` API関数作成
- [x] `fetchUserStats(pubkey)` API関数作成
- [x] `recordViews(events[], type, viewerPubkey)` API関数作成
- [x] `extractSuperMentionPaths(content)` ユーティリティ作成
- [x] `extractOgpUrls(content)` ユーティリティ作成
- [x] `useTimelineData.ts` 書き換え
  - `loadEnrichForEvents` でenrich API呼び出し
  - `loadOgpForEvents` でOGP batch API呼び出し
- [x] `useTimeline.ts` に `wikidataMap`, `ogpMap` state追加
- [x] `usePostViewData.ts` 書き換え
  - 個別API呼び出しをenrich APIに統合
- [x] `useMyStats.ts` 書き換え
  - 3つの個別API → `fetchUserStats` 1回に統合
- [x] タイムライン → 個別ページ遷移時のローカルデータ再利用
  - state/context でタイムラインのデータを保持
  - 遷移時にデータを渡す
- [x] 削除対象のAPI関数を削除（fetchProfiles）
- [x] `PostContent` にwikidataMap, ogpMap propsを追加
- [x] `LinkPreview` にogpData propsを追加

---

## 閲覧記録について

### 2種類のカウント

| 種類 | いつ記録 | 意味 |
|------|---------|------|
| impression | タイムラインに表示されたとき | 表示回数（配列でまとめて1回） |
| detail | 個別ページを開いたとき | 詳細閲覧数（開くたびに1回） |

### 読み取り vs 書き込み

- **読み取り**: `POST /api/events/enrich` でカウント値を取得
- **書き込み**: `POST /api/views/record` でカウントを+1

投稿カードの「10/50」表示：
- 分子（10）= detail
- 分母（50）= impression

---

## Super-mention Lookup 最適化

> **統合済み:** `POST /api/events/enrich` に統合。以下は課題と解決方針の記録。

### 背景（課題）

タイムライン表示時に、各投稿カード内のPostContentコンポーネントが独立して `/api/super-mention/lookup` を呼び出している。
super-mention（@@path形式）を含む投稿が多いと、50件のタイムラインで数十回のAPI呼び出しが発生する。

### 解決

`POST /api/events/enrich` にsuper-mentionパスを含めて送信し、レスポンスで `superMentions` マッピングを受け取る。

```
フロントエンド:
  1. 全投稿のcontentからsuper-mentionパスを抽出
  2. POST /api/events/enrich { eventIds, viewerPubkey, superMentionPaths }
  3. レスポンスの superMentions をPostContentにpropsで渡す
```

---

## OGP Lookup 最適化

> **新規API:** `POST /api/ogp/batch` で一括取得。

### 背景（課題）

投稿内のリンクごとに `LinkPreview` コンポーネントが独立して `/api/ogp` を呼び出している。
リンクを多く含むタイムラインでは大量のOGP取得リクエストが発生する。

### 解決

```
フロントエンド:
  1. 全投稿のcontentからリンクプレビュー対象URLを抽出（重複除去）
  2. POST /api/ogp/batch { urls: [...] }
  3. レスポンスの ogpMap をLinkPreviewにpropsで渡す
```
