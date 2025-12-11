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

### packages/web (React SPA)

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
│   │   └── SearchButton.tsx
│   ├── PostForm.tsx
│   ├── Timeline.tsx
│   ├── PostView.tsx
│   ├── UserView.tsx
│   ├── Settings.tsx
│   ├── ProfileSetup.tsx
│   ├── LongModeEditor.tsx
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
│   │   ├── navigation.ts
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

### packages/api (Hono API)

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
| POST | /api/publish | 署名済みイベントをリレーに投稿 |
| GET | /health | ヘルスチェック |

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
└── UserView (/user/:pubkey)
    └── ...
```
