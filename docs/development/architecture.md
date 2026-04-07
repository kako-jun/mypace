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
          │    │  - プロフィール     │     │  - stella-balance (D1)      │
          │    │  - 投稿/削除        │     │  - tweet埋め込み            │
          │    │  - リアクション     │     │  - serial/sticker/pins      │
          │    │  - リポスト         │     │  - wordrot/supernovas       │
          │    │                     │     │  - notifications/push       │
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
   - タグフィルタ（#mypace等）・全文検索はリレー側で実行
   - 言語、NG、ミュート等のフィルタはクライアント側で実行
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

5. **ステラ記録** (`/api/publish` → D1の `user_stella` に記録)
   - ステラ情報を記録（D1）
   - **0→1**：ブラウザがkind:7をリレーに送信 + `/api/publish` でステラ記録
   - **1→2, 2→3, ...10**：`/api/publish` でステラ記録を更新するだけ
   - **削除（1→0）**：ブラウザがkind:5をリレーに送信 + `/api/publish` でステラ記録を削除
   - **ステラバランス**: `/api/stella-balance` で残高取得・送信

6. **その他の独自機能**
   - `/api/serial` - 通し番号
   - `/api/sticker` - ステッカー
   - `/api/pins` - ピン留め
   - `/api/uploads` - アップロード履歴
   - `/api/publish` - イベント記録（ステラ、通し番号等をD1に記録）
   - `/api/profiles` - プロフィール取得（OGP用）
   - `/api/events` - イベント取得・エンリッチ（views + スーパーメンション一括取得）

7. **Web Push通知** (`/api/push`)
   - 購読登録/解除
   - 通知設定の変更
   - VAPID公開鍵の提供
   - ステラ/リプライ/リポスト発生時にプッシュ送信

8. **通知** (`/api/notifications`)
   - 通知一覧取得
   - 未読チェック
   - 既読マーク

9. **ステラバランス** (`/api/stella-balance`)
   - ステラ残高取得・送信

10. **スーパーノヴァ** (`/api/supernovas`)
    - 実績定義・ユーザー実績・解除チェック・統計

11. **ワードロット** (`/api/wordrot`)
    - 名詞抽出・コレクション・合成・インベントリ

12. **マガジン** (`/api/magazine`)
    - マガジン閲覧数記録

13. **NPC Reporter** (`/api/npc/reporter`)
    - URL共有記事の引用投稿

14. **サイトマップ** (`/api/sitemap`)
    - 動的サイトマップ生成

15. **ユーザー統計** (`/api/user`)
    - ユーザー統計情報取得

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
│   ├── form/            # フォーム関連
│   ├── image/           # 画像・動画編集（ImageEditor, VideoEditor）
│   ├── drawing/         # 手描き入力
│   ├── voice/           # 音声入力
│   ├── location/        # 位置情報
│   ├── user/            # ユーザー関連
│   ├── stats/           # 統計ウィジェット
│   ├── layout/          # レイアウト
│   ├── magazine/        # マガジン
│   ├── notification/    # 通知パネル
│   ├── npc/             # NPC関連
│   ├── pwa/             # PWAインストールバナー
│   ├── sticker/         # ステッカー
│   ├── superMention/    # スーパーメンション
│   ├── supernova/       # スーパーノヴァ実績
│   ├── wordrot/         # ワードロット
│   └── ui/              # 汎用UIコンポーネント
│
├── hooks/               # カスタムフック
│   ├── timeline/        # タイムライン関連
│   │   ├── useTimeline.ts
│   │   ├── useTimelinePolling.ts
│   │   └── useTimelineData.ts
│   ├── post/            # 投稿関連
│   ├── ui/              # UI関連
│   ├── upload/          # アップロード関連
│   ├── user/            # ユーザー関連
│   ├── wordrot/         # ワードロット関連
│   ├── useMyStats.ts    # 統計
│   └── usePushNotifications.ts # Push通知
│
├── lib/                 # ライブラリ
│   ├── nostr/           # Nostr関連
│   │   ├── events.ts    # イベント生成・署名
│   │   ├── relay.ts     # リレー直接接続
│   │   ├── keys.ts      # 鍵管理
│   │   ├── tags.ts      # タグ解析
│   │   ├── filters.ts   # クライアント側フィルタ
│   │   ├── format.ts    # フォーマット
│   │   ├── theme.ts     # テーマ
│   │   └── constants.ts # Nostr定数
│   ├── api/             # APIクライアント（補助API用）
│   │   ├── api.ts       # メインAPIクライアント
│   │   ├── upload.ts    # アップロード用
│   │   └── index.ts     # エクスポート
│   ├── animatedWebpEncoder.ts # 動画→アニメWebP変換（wasm-webp）
│   ├── barcode/         # バーコード生成
│   ├── i18n/            # 国際化
│   ├── utils/           # ユーティリティ
│   ├── storage/         # localStorage管理
│   ├── constants/       # 定数
│   └── parser/          # コンテンツパーサー
│       ├── content-parser.tsx
│       ├── emoji.ts
│       ├── code-blocks.ts
│       └── ...
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
│   ├── index.ts         # ルートエクスポート
│   ├── events.ts        # イベント取得・エンリッチ
│   ├── profiles.ts      # プロフィール取得
│   ├── publish.ts       # イベント記録
│   ├── ogp.ts           # OGP取得
│   ├── views.ts         # 閲覧数記録
│   ├── stella-balance.ts # ステラバランス
│   ├── tweet.ts         # X埋め込み
│   ├── wikidata.ts      # Wikidata検索
│   ├── super-mention.ts # スーパーメンション
│   ├── serial.ts        # 通し番号
│   ├── sticker.ts       # ステッカー
│   ├── pins.ts          # ピン留め
│   ├── uploads.ts       # アップロード履歴
│   ├── notifications.ts # 通知
│   ├── push.ts          # Web Push
│   ├── supernovas.ts    # スーパーノヴァ実績
│   ├── magazine.ts      # マガジン
│   ├── wordrot.ts       # ワードロット
│   ├── sitemap.ts       # サイトマップ
│   ├── user-count.ts    # ユーザー統計
│   ├── well-known.ts    # .well-known
│   ├── raw.ts           # Raw content
│   └── npc/             # NPCルート
│       ├── index.ts
│       └── reporter.ts  # NPC Reporter
├── services/            # サービス層
│   ├── index.ts
│   ├── cache.ts
│   ├── stella.ts
│   └── web-push.ts
└── types.ts             # 型定義
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
| `notifications` | アプリ内通知（ステラ/リプライ/リポスト） |
| `push_subscriptions` | Web Push購読情報（エンドポイント、鍵） |
| `user_stella_balance` | ステラ残高（色別ウォレット） |
| `supernova_definitions` | スーパーノヴァ実績定義 |
| `user_supernovas` | ユーザーのスーパーノヴァ解除記録 |
| `magazine_views` | マガジン閲覧数 |
| `magazine_view_users` | マガジンユニーク閲覧者 |
| `magazine_ogp_cache` | マガジンOGPキャッシュ |
| `wordrot_words` | ワードロット：単語マスター |
| `wordrot_user_words` | ワードロット：ユーザーコレクション |
| `wordrot_syntheses` | ワードロット：合成履歴 |
| `wordrot_event_words` | ワードロット：名詞抽出キャッシュ |
| `wordrot_image_queue` | ワードロット：画像生成キュー |
| `sitemap_events` | 動的サイトマップ用イベント |

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
| Workers AI | api | ワードロット名詞抽出・合成 |

---

## PWAサポート

vite-plugin-pwaによるPWA対応:

- **manifest.webmanifest**: アプリメタデータ（名前、アイコン、display: standalone）
- **Service Worker**: Workbox によるプリキャッシュ・ランタイムキャッシュ
  - 静的アセット（JS、CSS、HTML、画像）をプリキャッシュ
  - Google Fontsを1年間キャッシュ
  - **Web Push通知の受信・表示**
- **インストール**: ホーム画面追加でネイティブアプリ風に起動
- **プッシュ通知**: VAPID認証でサーバーからブラウザへ通知送信

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
  auth: {
    sk: string           // レガシー単一キー（keys[]に移行済み）
    keys: string[]       // 複数の秘密鍵（hex）
    activeIndex: number  // アクティブなキーのインデックス
    useNip07: boolean    // NIP-07拡張を使用するか
  }
  cache: { profile: Profile | null }
  editor: { vimMode: boolean, draft: string, draftReplyTo: string }
  pwa: { installDismissedAt: number | null }
}
```

| カテゴリ | 内容 | エクスポート |
|----------|------|--------------|
| theme | テーマモード、グラデーション色 | Yes |
| filters | フィルタ設定、プリセット、ミュートリスト | Yes |
| auth | 秘密鍵（複数キー対応、NIP-07切り替え） | No |
| cache | 自分のプロフィール | No |
| editor | Vimモード、下書き | No |
| pwa | PWAインストールバナー非表示タイムスタンプ | No |
