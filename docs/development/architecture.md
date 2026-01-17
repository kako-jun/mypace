# アーキテクチャ

## 概要

ブラウザがNostrリレーに直接接続するアーキテクチャ。APIは補助的な役割のみ。

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser                                    │
│  ┌─────────────┐  ┌─────────────────────────────────────────────┐   │
│  │ NIP-07 Ext  │  │ React SPA                                   │   │
│  │ (optional)  │  │  ├─ nostr-tools (リレー直接接続)            │   │
│  └──────┬──────┘  │  ├─ タイムライン取得                        │   │
│         │         │  ├─ プロフィール取得                        │   │
│         │         │  ├─ 投稿(publish)                           │   │
│         │         │  └─ リアクション/リポスト                   │   │
│         │         └──────────────────┬──────────────────────────┘   │
└─────────┼────────────────────────────┼──────────────────────────────┘
          │                            │
          │              ┌─────────────┴─────────────┐
          │              │                           │
          │              ▼                           ▼
          │    ┌─────────────────────┐     ┌─────────────────────────────┐
          │    │   Nostr Relays      │     │  Hono API (CF Workers)      │
          │    │ (nos.lol, etc.)     │     │                             │
          │    │                     │     │  - OGP取得                  │
          │    │  - タイムライン     │     │  - views記録 (D1)           │
          │    │  - プロフィール     │     │  - stella記録 (D1)          │
          │    │  - 投稿/削除        │     │  - tweet埋め込み            │
          │    │  - リアクション     │     │  - serial/sticker/pins      │
          │    │  - リポスト         │     │                             │
          │    └─────────────────────┘     │  ┌─────────────────────┐    │
          │                                │  │ Cloudflare D1       │    │
          │                                │  │ (独自データ)        │    │
          │                                │  └─────────────────────┘    │
          │                                └─────────────────────────────┘
          │
    ┌─────▼─────┐
    │ Secret Key│
    │ (local)   │
    └───────────┘
```

## データフロー

### ブラウザ側の責務

1. **タイムライン取得**
   - nostr-toolsでリレーに直接接続
   - フィルタリング（mypace/all、言語、NG等）はAPI側で実行
   - 取得件数: 200件

2. **ユーザー投稿取得**
   - ユーザーページの投稿一覧

3. **プロフィール取得**
   - kind:0イベントを直接取得

4. **投稿・リアクション・リポスト**
   - 署名はブラウザ（NIP-07 or 秘密鍵）
   - リレーへ直接送信

5. **メタデータ取得**
   - reactions, replies, reposts をリレーから直接取得

### API側の責務（補助のみ）

1. **X埋め込み取得** (`/api/tweet/:id`)
   - Twitter/X APIへのプロキシ（CORSの関係で必要）

2. **OGP取得** (`/api/ogp`)
   - URLのOGP情報取得（CORSの関係で必要）
   - D1にキャッシュ

3. **Wikidata取得** (`/api/wikidata`)
   - super-mention用

4. **インプレッション記録** (`/api/views`)
   - 表示回数の記録（D1）

5. **ステラ記録** (`/api/stella`)
   - ステラ情報を記録（D1）
   - **0→1**：ブラウザがkind:7をリレーに送信 + APIにステラ記録
   - **1→2, 2→3, ...10**：APIにステラ記録を更新するだけ
   - **削除（1→0）**：ブラウザがkind:5をリレーに送信 + APIからステラ記録を削除

6. **その他の独自機能**
   - `/api/serial` - 通し番号
   - `/api/sticker` - ステッカー
   - `/api/pins` - ピン留め
   - `/api/uploads` - アップロード履歴

---

## パッケージ

### apps/web (React SPA)

Cloudflare Pages にデプロイされる静的 SPA。

```
src/
├── components/          # UIコンポーネント
│   ├── post/            # 投稿関連
│   ├── settings/        # 設定パネルセクション
│   ├── embed/           # 外部埋め込みコンポーネント
│   ├── timeline/        # タイムライン関連
│   ├── filter/          # フィルター関連
│   ├── location/        # 位置情報
│   ├── user/            # ユーザー関連
│   ├── stats/           # 統計ウィジェット
│   └── ui/              # 汎用UIコンポーネント
│
├── hooks/               # カスタムフック
│   ├── timeline/        # タイムライン関連
│   │   ├── useTimeline.ts
│   │   ├── useTimelinePolling.ts
│   │   └── useTimelineData.ts
│   ├── post/            # 投稿関連
│   └── ...
│
├── lib/                 # ライブラリ
│   ├── nostr/           # Nostr関連
│   │   ├── events.ts    # イベント生成・署名
│   │   ├── relay.ts     # リレー直接接続
│   │   ├── keys.ts      # 鍵管理
│   │   ├── tags.ts      # タグ解析
│   │   └── constants.ts # Nostr定数
│   ├── api.ts           # APIクライアント（補助API用）
│   ├── utils/           # ユーティリティ
│   ├── storage/         # localStorage管理
│   ├── constants/       # 定数
│   └── parser.tsx       # コンテンツパーサー
│
├── pages/               # ルートコンポーネント
├── styles/              # CSS
├── types/               # TypeScript型定義
├── App.tsx              # ルーティング
└── main.tsx             # エントリポイント
```

### apps/api (Hono API)

Cloudflare Workers にデプロイされる API サーバー。

```
src/
├── index.ts             # ルーティング
├── routes/              # 各エンドポイント
│   ├── ogp.ts
│   ├── views.ts
│   ├── stella.ts
│   ├── tweet.ts
│   ├── wikidata.ts
│   ├── serial.ts
│   ├── sticker.ts
│   ├── pins.ts
│   └── uploads.ts
└── lib/                 # 共通ライブラリ
```

---

## D1データベース

MY PACE独自データのみ保存（Nostrイベントのキャッシュは持たない）。

### テーブル

| テーブル | 用途 |
|----------|------|
| `user_stella` | ステラ記録（Nostrにはない独自機能） |
| `user_serial` | 通し番号（MY PACE独自） |
| `event_views` | 閲覧記録（誰がどのイベントを見たか） |
| `ogp_cache` | OGPキャッシュ（APIプロキシ用） |
| `super_mention_paths` | スーパーメンション履歴 |
| `sticker_history` | ステッカー履歴 |
| `user_pins` | ピン留め投稿 |
| `upload_history` | アップロード履歴 |

---

## 定数

### タイムライン

| 定数 | 値 | 説明 |
|------|-----|------|
| `TIMELINE_FETCH_LIMIT` | 200 | 1回の取得件数 |
| `MAX_TIMELINE_ITEMS` | 200 | DOM要素上限（パフォーマンス対策） |
| `POLLING_INTERVAL` | 60秒 | 新着チェック間隔 |

---

## Cloudflareサービス

| サービス | パッケージ | 用途 |
|---------|---------|---------|
| Pages | web | 静的SPAホスティング |
| Workers | api | 補助APIサーバー |
| D1 | api | 独自データ保存 |

---

## PWAサポート

vite-plugin-pwaによるPWA対応:

- **manifest.webmanifest**: アプリメタデータ（名前、アイコン、display: standalone）
- **Service Worker**: Workbox によるプリキャッシュ・ランタイムキャッシュ
  - 静的アセット（JS、CSS、HTML、画像）をプリキャッシュ
  - Google Fontsを1年間キャッシュ
- **インストール**: ホーム画面追加でネイティブアプリ風に起動

---

## モーダルナビゲーション

タイムラインからの投稿詳細表示にはモーダルパターンを採用:

1. タイムラインで投稿クリック → `navigateToPostModal(eventId)`
2. URLは `/post/:id` に変更（共有可能）
3. `location.state.backgroundLocation` にタイムラインの位置を保存
4. PostModal がオーバーレイ表示、背景にタイムラインが残る
5. 戻る/閉じる → タイムラインのスクロール位置が保持される

直接 `/post/:id` にアクセスした場合は通常のフルページ表示。

---

## クライアントサイドキャッシュ

`sessionStorage` を使用したクライアント側キャッシュ:

| 関数 | 説明 |
|------|------|
| `cachePost(event)` | 投稿をキャッシュに保存 |
| `getCachedPost(eventId)` | キャッシュから投稿を取得 |
| `cacheProfile(pubkey, profile)` | プロフィールをキャッシュに保存 |
| `getCachedProfile(pubkey)` | キャッシュからプロフィールを取得 |

---

## localStorageの構造

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
