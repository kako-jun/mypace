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
│   │   ├── TimelinePostCard.tsx
│   │   ├── FilterBar.tsx
│   │   └── SearchBox.tsx
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
│   │   ├── navigation.ts       # URL遷移
│   │   ├── router-navigation.ts # React Router統合
│   │   ├── image.ts
│   │   ├── content.ts
│   │   ├── clipboard.ts
│   │   ├── storage.ts
│   │   ├── settings.ts
│   │   ├── profile.ts
│   │   ├── time.ts
│   │   ├── error.ts
│   │   ├── json.ts
│   │   └── cache.ts
│   ├── constants/       # 定数
│   │   ├── ui.ts
│   │   └── storage.ts
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
| GET | /api/replies/:eventId | 返信一覧 |
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
