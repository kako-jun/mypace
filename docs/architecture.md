# Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser                                 │
│  ┌─────────────┐  ┌─────────────────────────────────────┐   │
│  │ NIP-07 Ext  │  │ Home (状態管理)                     │   │
│  │ (optional)  │  │  ├─ PostForm (左下固定, → relay)    │   │
│  └──────┬──────┘  │  └─ Timeline (← API)                │   │
│         │         └──────────────────┬──────────────────┘   │
└─────────┼────────────────┼─────────────────────┼────────────┘
          │                │                     │
          │                ▼                     │
          │    ┌─────────────────────┐           │
          │    │   Nostr Relays      │           │
          │    │ (nos.lol, etc.)     │◄──────────┤
          │    └─────────────────────┘           │
          │                                      │
          │                ▼                     ▼
          │    ┌─────────────────────────────────────────┐
          │    │        HonoX (Cloudflare Pages)         │
          │    │  ┌─────────────┐  ┌─────────────────┐   │
          │    │  │ SSR Pages   │  │ API Routes      │   │
          │    │  │ /           │  │ /api/timeline   │   │
          │    │  └─────────────┘  └────────┬────────┘   │
          │    │                            │            │
          │    │                   ┌────────▼────────┐   │
          │    │                   │ Cloudflare D1   │   │
          │    │                   │ (cache)         │   │
          │    │                   └─────────────────┘   │
          │    └─────────────────────────────────────────┘
          │
    ┌─────▼─────┐
    │ Secret Key│
    │ (local)   │
    └───────────┘
```

## Folder Structure

```
app/
├── routes/                  # HonoXルーティング
│   ├── _renderer.tsx        # 共通HTMLレイアウト
│   ├── index.tsx            # トップページ
│   ├── api/
│   │   └── timeline.ts      # タイムラインAPI
│   ├── post/
│   │   └── [id].tsx         # 個別投稿ページ
│   ├── tag/
│   │   └── [tag].tsx        # タグフィルタページ
│   └── user/
│       └── [pubkey].tsx     # ユーザーページ
│
├── islands/                 # Islandコンポーネント（hydrate対象）
│   ├── Home.tsx             # ホーム画面（状態管理）
│   ├── PostForm.tsx         # 投稿フォーム
│   ├── Timeline.tsx         # タイムライン表示
│   ├── PostView.tsx         # 個別投稿詳細
│   ├── UserView.tsx         # ユーザーページ
│   ├── Settings.tsx         # 設定パネル（Settings/Aboutタブ）
│   ├── ProfileSetup.tsx     # プロフィール設定
│   ├── LongModeEditor.tsx   # 長文エディタ（CodeMirror）
│   ├── LightBox.tsx         # 画像拡大表示モーダル
│   └── Logo.tsx             # ロゴ
│
├── components/              # 再利用可能コンポーネント
│   ├── post/                # 投稿関連
│   │   ├── PostHeader.tsx   # 投稿ヘッダー
│   │   ├── PostActions.tsx  # いいね・リポスト等
│   │   ├── PostPreview.tsx  # プレビュー表示
│   │   ├── EditDeleteButtons.tsx
│   │   ├── DeleteConfirmDialog.tsx
│   │   ├── AttachedImages.tsx
│   │   ├── ImageDropZone.tsx
│   │   ├── ThreadReplies.tsx
│   │   └── ReplyCard.tsx
│   ├── settings/            # 設定パネルセクション
│   │   ├── ProfileSection.tsx
│   │   ├── ThemeSection.tsx
│   │   ├── EditorSection.tsx
│   │   ├── KeysSection.tsx
│   │   └── ShareSection.tsx
│   ├── timeline/            # タイムライン関連
│   │   ├── TimelinePostCard.tsx
│   │   └── FilterBar.tsx
│   └── ui/                  # 汎用UIコンポーネント
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Toggle.tsx
│       └── ColorPicker.tsx
│
├── hooks/                   # カスタムフック
│   ├── useTimeline.ts       # タイムライン取得・更新
│   ├── useDeleteConfirm.ts  # 削除確認ダイアログ
│   ├── useImageUpload.ts    # 画像アップロード
│   ├── useDragDrop.ts       # ドラッグ&ドロップ
│   ├── useShare.ts          # シェア機能
│   └── useTemporaryState.ts # 一時的状態管理
│
├── lib/                     # ライブラリ
│   ├── nostr/               # Nostr関連
│   │   ├── events.ts        # イベント生成
│   │   ├── relay.ts         # リレー通信
│   │   ├── keys.ts          # 鍵管理
│   │   ├── tags.ts          # タグ解析
│   │   ├── theme.ts         # テーマ関連
│   │   ├── format.ts        # npub/nsec変換
│   │   └── constants.ts     # Nostr定数
│   ├── db/
│   │   └── cache.ts         # D1キャッシュ
│   ├── utils/               # ユーティリティ
│   │   ├── navigation.ts    # ナビゲーション
│   │   ├── image.ts         # 画像URL処理
│   │   ├── content.ts       # コンテンツ解析
│   │   ├── clipboard.ts     # クリップボード
│   │   ├── storage.ts       # localStorage
│   │   ├── settings.ts      # 設定管理
│   │   ├── profile.ts       # プロフィール
│   │   ├── time.ts          # 時間フォーマット
│   │   ├── error.ts         # エラーハンドリング
│   │   ├── json.ts          # JSON安全パース
│   │   └── cache.ts         # キャッシュユーティリティ
│   ├── constants/           # 定数
│   │   ├── ui.ts            # UI定数
│   │   └── storage.ts       # ストレージキー
│   ├── content-parser.tsx   # コンテンツパーサー
│   └── upload.ts            # 画像アップロード
│
├── styles/                  # CSS
│   ├── tailwind.css         # Tailwind設定
│   ├── base.css             # ベーススタイル（color-mix変数）
│   └── components/          # コンポーネント固有
│       ├── post-form.css
│       ├── timeline.css
│       ├── settings.css
│       ├── post-view.css
│       ├── profile-setup.css
│       ├── long-mode-editor.css
│       ├── lightbox.css     # 画像拡大モーダル
│       └── user-view.css    # ユーザーページ
│
├── types/
│   └── index.ts             # TypeScript型定義
│
├── client.ts                # クライアントエントリ
├── server.ts                # サーバーエントリ
└── global.d.ts              # グローバル型宣言
```

## Data Flow

### Post (Client → Relay)
1. User types content
2. Client JS builds Nostr event (kind:1)
3. Sign with localStorage key or NIP-07
4. WebSocket → Relay directly

### Read (Client → API → Relay)
1. Client fetches `/api/timeline`
2. API checks D1 cache (5min TTL)
3. Cache miss → fetch from relays → cache to D1
4. Return JSON

## Cloudflare Services

| Service | Purpose |
|---------|---------|
| Pages | Host HonoX app (SSR + API) |
| D1 | SQLite cache for events |

## HonoX Features Used

- **Islands Architecture**: Only interactive parts hydrate
- **File-based Routing**: `app/routes/`
- **SSR**: Server-side rendering for fast first paint
- **c.env**: Access D1 bindings

## Component Hierarchy

```
routes/index.tsx
└── islands/Home.tsx (状態管理)
    ├── islands/PostForm.tsx
    │   ├── components/post/AttachedImages.tsx
    │   ├── components/post/ImageDropZone.tsx
    │   └── islands/LongModeEditor.tsx
    ├── islands/Timeline.tsx
    │   └── components/timeline/TimelinePostCard.tsx
    │       ├── components/post/PostHeader.tsx
    │       ├── components/post/PostActions.tsx
    │       └── components/post/PostPreview.tsx
    ├── islands/Settings.tsx (Settings/Aboutタブ)
    │   ├── components/settings/ProfileSection.tsx
    │   ├── components/settings/ThemeSection.tsx
    │   ├── components/settings/EditorSection.tsx
    │   ├── components/settings/KeysSection.tsx
    │   └── components/settings/ShareSection.tsx
    └── islands/LightBox.tsx (画像拡大モーダル)

routes/user/[pubkey].tsx
└── islands/UserView.tsx (ユーザー詳細+投稿一覧)
    ├── components/timeline/TimelinePostCard.tsx
    └── islands/LightBox.tsx
```

## Important Notes

- HonoXはhono/jsxを使用（Reactではない）
- `useMemo`, `useCallback`等のReact Hooksは使用不可
- Islandsのみがクライアントでhydrate
- 型定義は `app/types/index.ts` に集約
