# Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser                                    │
│  ┌─────────────┐  ┌─────────────────────────────────────────────┐   │
│  │ NIP-07 Ext  │  │ React SPA                                   │   │
│  │ (optional)  │  │  ├─ PostForm (署名 → API)                   │   │
│  └──────┬──────┘  │  └─ Timeline (← API)                        │   │
│         │         └──────────────────┬──────────────────────────┘   │
└─────────┼────────────────────────────┼──────────────────────────────┘
          │                            │
          │                            ▼
          │    ┌─────────────────────────────────────────────────────┐
          │    │              Hono API (Cloudflare Workers)          │
          │    │                                                     │
          │    │  GET /api/timeline     ← タイムライン取得           │
          │    │  GET /api/events/:id   ← 単一イベント取得           │
          │    │  GET /api/profiles     ← プロフィール取得           │
          │    │  GET /api/reactions/:id                             │
          │    │  GET /api/replies/:id                               │
          │    │  GET /api/reposts/:id                               │
          │    │  GET /api/user/:pubkey/events                       │
          │    │  POST /api/publish     ← 署名済みイベント投稿       │
          │    │                                                     │
          │    │  ┌─────────────────┐  ┌─────────────────────────┐   │
          │    │  │ Cloudflare D1   │  │ SOCKS5 Proxy (optional) │   │
          │    │  │ (cache)         │  └───────────┬─────────────┘   │
          │    │  └────────┬────────┘              │                 │
          │    └───────────┼───────────────────────┼─────────────────┘
          │                │                       │
          │                │                       ▼
          │                │           ┌─────────────────────┐
          │                │           │   Nostr Relays      │
          │                │           │ (nos.lol, etc.)     │
          │                │           └─────────────────────┘
          │                │
    ┌─────▼─────┐          │
    │ Secret Key│          │
    │ (local)   │          │
    └───────────┘          │
                           │
                    ┌──────▼──────┐
                    │ React SPA   │
                    │ (static)    │
                    │ Cloudflare  │
                    │ Pages       │
                    └─────────────┘
```

## Packages

### apps/web (React SPA)

Cloudflare Pages にデプロイされる静的 SPA。

```
src/
├── components/          # UIコンポーネント
│   ├── post/            # 投稿関連
│   │   ├── PostHeader.tsx
│   │   ├── PostActions.tsx
│   │   ├── PostPreview.tsx
│   │   ├── EditDeleteButtons.tsx
│   │   ├── DeleteConfirmDialog.tsx
│   │   ├── AttachedImages.tsx
│   │   ├── ImageDropZone.tsx
│   │   ├── ThreadReplies.tsx
│   │   └── ReplyCard.tsx
│   ├── settings/        # 設定パネルセクション
│   │   ├── ProfileSection.tsx
│   │   ├── ThemeSection.tsx
│   │   ├── EditorSection.tsx
│   │   ├── KeysSection.tsx
│   │   └── ShareSection.tsx
│   ├── embed/           # 外部埋め込みコンポーネント
│   │   ├── YouTubeEmbed.tsx
│   │   ├── YouTubeShortsEmbed.tsx
│   │   ├── TwitterEmbed.tsx
│   │   ├── InstagramEmbed.tsx
│   │   ├── TikTokEmbed.tsx
│   │   ├── SpotifyEmbed.tsx
│   │   ├── VideoEmbed.tsx
│   │   ├── IframeEmbed.tsx
│   │   └── LinkPreview.tsx
│   ├── timeline/        # タイムライン関連
│   │   └── TimelinePostCard.tsx
│   ├── ui/              # 汎用UIコンポーネント
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Toggle.tsx
│   │   ├── ColorPicker.tsx
│   │   ├── Icon.tsx
│   │   ├── Avatar.tsx
│   │   ├── Loading.tsx    # ローディングオーバーレイ
│   │   └── SearchButton.tsx
│   ├── PostForm.tsx
│   ├── Timeline.tsx
│   ├── PostView.tsx
│   ├── PostModal.tsx       # モーダル投稿詳細
│   ├── UserView.tsx
│   ├── Settings.tsx
│   ├── ProfileSetup.tsx
│   ├── LongModeEditor.tsx
│   ├── Layout.tsx
│   ├── FilterPanel.tsx
│   └── LightBox.tsx
│
├── hooks/               # カスタムフック
│   ├── useTimeline.ts   # タイムライン取得・更新
│   ├── useDeleteConfirm.ts
│   ├── useImageUpload.ts
│   ├── useDragDrop.ts
│   ├── useShare.ts
│   └── useTemporaryState.ts
│
├── lib/                 # ライブラリ
│   ├── api.ts           # APIクライアント
│   ├── nostr/           # Nostr関連
│   │   ├── events.ts    # イベント生成・署名
│   │   ├── relay.ts     # API経由のリレー通信ラッパー
│   │   ├── keys.ts      # 鍵管理
│   │   ├── tags.ts      # タグ解析
│   │   ├── theme.ts     # テーマ関連
│   │   ├── format.ts    # npub/nsec変換
│   │   └── constants.ts # Nostr定数
│   ├── utils/           # ユーティリティ
│   │   ├── navigation/         # URL遷移
│   │   ├── storage/            # sessionStorageキャッシュ
│   │   ├── filter/             # フィルタ・ミュートリスト
│   │   ├── profile/            # プロフィール
│   │   ├── embed/              # 埋め込み判定
│   │   ├── image.ts
│   │   ├── content.ts
│   │   ├── clipboard.ts
│   │   ├── settings.ts
│   │   ├── time.ts
│   │   ├── error.ts
│   │   ├── json.ts
│   │   └── animated.ts
│   ├── storage/         # localStorage管理（統合）
│   │   └── index.ts     # 全設定を単一キー"mypace"で管理
│   ├── constants/       # 定数
│   │   └── ui.ts
│   ├── content-parser.tsx
│   └── upload.ts        # 画像アップロード
│
├── pages/               # ルートコンポーネント
│   ├── HomePage.tsx
│   └── (react-router routes)
│
├── styles/              # CSS
│   ├── tailwind.css
│   ├── base.css
│   └── components/
│
├── types/
│   └── index.ts         # TypeScript型定義
│
├── App.tsx              # ルーティング
└── main.tsx             # エントリポイント
```

### apps/api (Hono API)

Cloudflare Workers にデプロイされる API サーバー。

```
src/
└── index.ts             # 全APIエンドポイント
```

## Data Flow

### 読み取り (Client → API → Relay)

1. フロントエンドが `/api/timeline` 等をfetch
2. APIがD1キャッシュをチェック
3. キャッシュミス → SOCKS5プロキシ経由でリレーに接続
4. イベント取得 → D1にキャッシュ → JSONで返却

### 書き込み (Client → API → Relay)

1. ユーザーがコンテンツを入力
2. クライアントでNostrイベント(kind:1等)を生成
3. localStorageの秘密鍵またはNIP-07で署名
4. 署名済みイベントを `POST /api/publish` に送信
5. APIがSOCKS5経由でリレーに publish

**重要**: 秘密鍵はサーバーに送信されない。署名は常にクライアント側で行う。

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/timeline | mypaceタグ付き投稿一覧 |
| GET | /api/events/:id | 単一イベント取得 |
| GET | /api/profiles | プロフィール取得（複数pubkey） |
| GET | /api/reactions/:eventId | リアクション数・自分のリアクション |
| GET | /api/replies/:eventId | 返信一覧（古い順） |
| GET | /api/reposts/:eventId | リポスト数・自分のリポスト |
| GET | /api/user/:pubkey/events | ユーザーの投稿一覧 |
| GET | /api/ogp | OGPメタデータ取得（リンクプレビュー用） |
| GET | /api/tweet/:id | ツイートデータ取得（react-tweet用） |
| POST | /api/publish | 署名済みイベントをリレーに投稿 |
| GET | /health | ヘルスチェック |

### Timeline Pagination

`/api/timeline` と `/api/user/:pubkey/events` は以下のクエリパラメータでページネーションをサポート:

| Parameter | Description |
|-----------|-------------|
| limit | 取得件数（最大100、デフォルト50） |
| since | この時刻より新しい投稿を取得（Unix timestamp） |
| until | この時刻より古い投稿を取得（Unix timestamp） |

**使用例:**
- 初回読み込み: `?limit=50`
- 新着取得: `?limit=50&since=1234567890`
- 過去読み込み: `?limit=50&until=1234567890`
- ギャップ埋め: `?limit=50&since=1234567800&until=1234567890`

## Cloudflare Services

| Service | Package | Purpose |
|---------|---------|---------|
| Pages | web | 静的SPAホスティング |
| Workers | api | APIサーバー |
| D1 | api | SQLiteキャッシュ |

## D1 Cache (Server-Side)

### 概要

APIサーバーはNostrリレーから取得したイベントをCloudflare D1にキャッシュする。
MYPACEタグ付き投稿もそれ以外も同様にキャッシュし、`has_mypace_tag`カラムで区別する。

### eventsテーブル

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT | イベントID（主キー） |
| pubkey | TEXT | 投稿者の公開鍵 |
| created_at | INTEGER | イベント作成時刻 |
| kind | INTEGER | イベント種別 |
| tags | TEXT | タグ（JSON） |
| content | TEXT | 本文 |
| sig | TEXT | 署名 |
| cached_at | INTEGER | キャッシュ保存時刻 |
| has_mypace_tag | INTEGER | mypaceタグの有無（0 or 1） |

### TTLと物理削除

| 設定 | 値 | 説明 |
|------|-----|------|
| 論理TTL | 5分 | これより古いキャッシュは取得されない |
| 物理削除 | 1日 | これより古いキャッシュはDBから削除 |

### 確率的クリーンアップ

キャッシュ書き込み時、**1%の確率**でバックグラウンドクリーンアップを実行:

```typescript
if (Math.random() < 0.01) {
  executionCtx.waitUntil(
    db.prepare('DELETE FROM events WHERE cached_at < ?')
      .bind(Date.now() - 24 * 60 * 60 * 1000) // 1日
      .run()
  )
}
```

- レスポンスに影響しない（waitUntilでバックグラウンド実行）
- 平均100リクエストに1回なので負荷分散
- 1日以上古いキャッシュは確実に削除される

## SOCKS5 Proxy Support

APIサーバーはオプションでSOCKS5プロキシ経由でリレーに接続可能。
`wrangler.toml` の `SOCKS5_PROXY` 環境変数で設定。

```toml
[vars]
SOCKS5_PROXY = "socks5://localhost:1080"
```

## Component Hierarchy

```
App.tsx (react-router)
├── HomePage
│   ├── PostForm
│   │   ├── AttachedImages
│   │   ├── ImageDropZone
│   │   └── LongModeEditor
│   ├── Timeline
│   │   └── TimelinePostCard
│   │       ├── PostHeader
│   │       ├── PostActions
│   │       └── ThreadReplies
│   ├── Settings
│   │   ├── ProfileSection
│   │   ├── ThemeSection
│   │   ├── EditorSection
│   │   ├── KeysSection
│   │   └── ShareSection
│   └── LightBox
│
├── PostView (/:postId)
│   └── ...
│
├── PostModal (モーダル表示時)
│   └── PostView
│
└── UserView (/user/:pubkey)
    └── ...
```

## PWA Support

vite-plugin-pwaによるPWA対応:

- **manifest.webmanifest**: アプリメタデータ（名前、アイコン、display: standalone）
- **Service Worker**: Workbox によるプリキャッシュ・ランタイムキャッシュ
  - 静的アセット（JS、CSS、HTML、画像）をプリキャッシュ
  - Google Fontsを1年間キャッシュ
- **インストール**: ホーム画面追加でネイティブアプリ風に起動

## Modal Navigation

タイムラインからの投稿詳細表示にはモーダルパターンを採用:

1. タイムラインで投稿クリック → `navigateToPostModal(eventId)`
2. URLは `/post/:id` に変更（共有可能）
3. `location.state.backgroundLocation` にタイムラインの位置を保存
4. PostModal がオーバーレイ表示、背景にタイムラインが残る
5. 戻る/閉じる → タイムラインのスクロール位置が保持される

直接 `/post/:id` にアクセスした場合は通常のフルページ表示。

## Client-Side Caching

`sessionStorage` を使用したクライアント側キャッシュ:

| 関数 | 説明 |
|------|------|
| `cachePost(event)` | 投稿をキャッシュに保存 |
| `getCachedPost(eventId)` | キャッシュから投稿を取得（削除しない） |
| `clearCachedPost(eventId)` | キャッシュから投稿を削除 |
| `cacheProfile(pubkey, profile)` | プロフィールをキャッシュに保存 |
| `getCachedProfile(pubkey)` | キャッシュからプロフィールを取得（削除しない） |
| `clearCachedProfile(pubkey)` | キャッシュからプロフィールを削除 |

**注意**: `getCachedPost` / `getCachedProfile` は読み取り時にキャッシュを削除しない。
これはReact 18 StrictModeでエフェクトが2回実行されても問題なく動作するため。

## localStorage Structure

全設定は単一の `mypace` キーで管理:

```typescript
interface MypaceStorage {
  // エクスポート可能
  theme: {
    mode: 'light' | 'dark'
    colors: ThemeColors
  }
  filters: SearchFilters & {
    presets: FilterPreset[]
    muteList: MuteEntry[]
  }
  // 非エクスポート
  auth: { sk: string }
  cache: { profile: Profile | null }
  editor: { vimMode, draft, draftReplyTo }
}
```

| カテゴリ | 内容 | エクスポート |
|----------|------|--------------|
| theme | テーマモード、グラデーション色 | Yes |
| filters | フィルタ設定、プリセット、ミュートリスト | Yes |
| auth | 秘密鍵（hex） | No |
| cache | 自分のプロフィール | No |
| editor | Vimモード、下書き | No |
