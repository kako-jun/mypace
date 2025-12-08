# mypace

HonoX + Cloudflare Pages + Nostr のマイクロブログサービス。

## Quick Reference

```bash
npm run dev      # 開発サーバー (localhost:5173)
npm run build    # ビルド
npm run preview  # Cloudflareローカルプレビュー
npm run deploy   # デプロイ
npm run lint     # ESLintチェック
npm run lint:fix # ESLint自動修正
npm run format   # Prettier整形
```

## Architecture

- **Frontend**: HonoX (Islands Architecture)
- **Backend**: Cloudflare Pages Functions
- **Database**: Cloudflare D1 (cache)
- **Auth**: Auto-generated keys (localStorage) + NIP-07

詳細は [docs/](./docs/) を参照。

## Folder Structure

```
app/
├── routes/              # ページルーティング
│   ├── api/             # APIエンドポイント
│   ├── post/            # 投稿詳細ページ
│   └── tag/             # タグフィルタページ
├── islands/             # Islandコンポーネント（hydrate対象）
├── components/          # 再利用可能コンポーネント
│   ├── post/            # 投稿関連UI
│   ├── settings/        # 設定パネルセクション
│   ├── timeline/        # タイムラインUI
│   └── ui/              # 汎用UI（Button, Toggle等）
├── hooks/               # カスタムフック
├── lib/                 # ライブラリ・ユーティリティ
│   ├── nostr/           # Nostr関連（events, relay, keys等）
│   ├── db/              # D1データベース
│   ├── utils/           # ユーティリティ関数
│   └── constants/       # 定数
├── styles/              # CSS（Tailwind + コンポーネント別）
│   └── components/      # コンポーネント固有スタイル
└── types/               # TypeScript型定義
```

## Features

- 投稿・閲覧（mypaceタグ付き投稿のみ表示）
- プロフィール設定（名前必須、アバター画像）
- 投稿の編集・削除（編集は投稿フォームで行い、返信タグを保持）
- 画像アップロード（nostr.build、NIP-98認証）
- 画像クリックでLightBox表示
- いいね（NIP-25 kind 7）- 自己いいね禁止
- 返信（NIP-10）- スレッド表示対応
- リポスト（NIP-18 kind 6）- タイムラインに「○○ reposted」表示
- NIP-07対応（ブラウザ拡張）
- 鍵のエクスポート・インポート（npub/nsecコピー対応）
- コンテンツパース（ハッシュタグ、URL、画像）
- ハッシュタグフィルタリング（日本語対応、複数タグAND/OR）
- ライト/ダークテーマ切り替え（Settings/Aboutタブ分離）
- ウィンドウカラー（4隅グラデーション背景）カスタマイズ
- 長文モード（4200文字対応、プレビュー付き、Vimモード対応）
- 下書き自動保存（localStorage）
- 個別投稿ページ（/post/{id}）
- ユーザーページ（/user/{pubkey}）
- RESTful URL（/tag/{hashtag}）
- Lucide Icons（ベクターアイコン）
- 八角形ボタンデザイン

## Key Files

### Routes
| Path | Description |
|------|-------------|
| `app/routes/index.tsx` | トップページ |
| `app/routes/post/[id].tsx` | 個別投稿ページ |
| `app/routes/tag/[tag].tsx` | タグフィルタページ |
| `app/routes/user/[pubkey].tsx` | ユーザーページ |
| `app/routes/api/timeline.ts` | タイムラインAPI |

### Islands（Hydrate対象）
| Path | Description |
|------|-------------|
| `app/islands/Home.tsx` | ホーム画面（状態管理、下書き保存） |
| `app/islands/PostForm.tsx` | 投稿フォーム（左下固定） |
| `app/islands/Timeline.tsx` | タイムライン表示 |
| `app/islands/PostView.tsx` | 個別投稿表示 |
| `app/islands/UserView.tsx` | ユーザー詳細・投稿一覧 |
| `app/islands/Settings.tsx` | 設定パネル（タブ切替対応） |
| `app/islands/ProfileSetup.tsx` | プロフィール設定 |
| `app/islands/LongModeEditor.tsx` | 長文エディタ（CodeMirror） |
| `app/islands/LightBox.tsx` | 画像拡大表示モーダル |
| `app/islands/Logo.tsx` | ロゴ（クリックでリロード） |

### Components
| Path | Description |
|------|-------------|
| `app/components/post/` | 投稿カード、アクション、ヘッダー等 |
| `app/components/settings/` | 設定パネルの各セクション |
| `app/components/timeline/` | タイムラインカード、フィルタバー |
| `app/components/ui/` | Button, Toggle, ColorPicker等 |

### Hooks
| Path | Description |
|------|-------------|
| `app/hooks/useTimeline.ts` | タイムライン取得・更新 |
| `app/hooks/useDeleteConfirm.ts` | 削除確認ダイアログ |
| `app/hooks/useImageUpload.ts` | 画像アップロード |
| `app/hooks/useDragDrop.ts` | ドラッグ&ドロップ |
| `app/hooks/useShare.ts` | シェア機能 |
| `app/hooks/useTemporaryState.ts` | 一時的状態管理 |

### Lib
| Path | Description |
|------|-------------|
| `app/lib/nostr/events.ts` | Nostrイベント生成、定数 |
| `app/lib/nostr/relay.ts` | リレー通信 |
| `app/lib/nostr/keys.ts` | 鍵管理 |
| `app/lib/nostr/tags.ts` | タグ解析 |
| `app/lib/nostr/theme.ts` | テーマ関連 |
| `app/lib/content-parser.tsx` | コンテンツパーサー |
| `app/lib/upload.ts` | 画像アップロード（NIP-98） |
| `app/lib/db/cache.ts` | D1キャッシュ層 |
| `app/lib/utils/` | 各種ユーティリティ関数 |

### Config
| Path | Description |
|------|-------------|
| `wrangler.toml` | Cloudflare設定 |
| `schema.sql` | D1スキーマ |
| `eslint.config.js` | ESLint設定（v9 flat config） |
| `.prettierrc` | Prettier設定 |

## Nostr Events

| kind | 用途 |
|------|------|
| 0 | プロフィール（name, display_name, picture） |
| 1 | 投稿（#mypaceタグ付き） |
| 5 | 削除リクエスト |
| 6 | リポスト（NIP-18） |
| 7 | リアクション/いいね（NIP-25） |
| 27235 | HTTP認証（NIP-98、画像アップロード用） |

## Development

### Lint & Format
- pre-commit hookでlint-stagedが自動実行
- ESLint: TypeScript/JSXルール
- Prettier: コードフォーマット（セミコロンなし、シングルクォート）

### 注意事項
- HonoXはhono/jsxを使用（ReactではないためuseMemo等なし）
- Islandsのみがクライアントでhydrate
- 型定義は `app/types/index.ts` に集約
