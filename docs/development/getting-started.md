# 開発環境

## 必要条件

- Node.js 20+
- pnpm 9+

## セットアップ

```bash
# 依存関係のインストール
pnpm install

# 開発サーバー起動
pnpm dev        # フロントエンド (localhost:5173)
pnpm dev:api    # API (localhost:8787)
```

## プロジェクト構成

```
mypace/
├── apps/
│   ├── web/                 # React SPA
│   │   ├── src/
│   │   │   ├── components/  # UIコンポーネント
│   │   │   ├── hooks/       # カスタムフック
│   │   │   ├── lib/         # ユーティリティ
│   │   │   │   ├── api.ts   # APIクライアント
│   │   │   │   └── nostr/   # Nostr関連
│   │   │   ├── pages/       # ルートコンポーネント
│   │   │   └── types/       # 型定義
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                 # Hono API
│       ├── src/
│       │   └── index.ts     # APIエンドポイント
│       ├── schema.sql       # D1スキーマ
│       ├── wrangler.toml    # Cloudflare設定
│       └── package.json
│
├── pnpm-workspace.yaml
└── package.json             # ルートスクリプト
```

## 新しいページの追加 (React Router)

`apps/web/src/App.tsx` にルートを追加:

```typescript
import { NewPage } from './pages/NewPage'

<Route path="/new" element={<NewPage />} />
```

## 新しいAPIエンドポイントの追加

`apps/api/src/index.ts` にエンドポイントを追加:

```typescript
app.get('/api/new-endpoint', async (c) => {
  const db = c.env.DB
  // ...
  return c.json({ data: 'value' })
})
```

## APIクライアント

フロントエンドからAPIを呼び出す場合は `lib/api.ts` を使用:

```typescript
import { fetchTimeline, publishEvent } from '../lib/api'

// タイムライン取得
const { events, source } = await fetchTimeline(50)

// イベント投稿（署名済み）
await publishEvent(signedEvent)
```

## Nostrイベントの署名

署名は常にクライアント側で行う:

```typescript
import { createTextNote } from '../lib/nostr/events'
import { publishEvent } from '../lib/nostr/relay'

// 1. イベント作成（内部で署名される）
const event = await createTextNote('Hello, Nostr!')

// 2. API経由でリレーに投稿
await publishEvent(event)
```

NIP-07 (ブラウザ拡張) がある場合は自動的にそちらで署名。

## 環境変数

### フロントエンド (apps/web)

`.env` ファイル:

```env
VITE_API_URL=http://localhost:8787
```

### API (apps/api)

`wrangler.toml`:

```toml
[vars]
SOCKS5_PROXY = "socks5://localhost:1080"  # Optional
```

## TypeScript

- **フロントエンド**: React + DOM types
- **API**: Cloudflare Workers types
- 型定義は各パッケージの `types/` または `src/types/` に配置

## コードスタイル

- ESLint + Prettier
- セミコロンなし
- シングルクォート
- pre-commit hook で自動整形

```bash
pnpm lint        # チェック
pnpm lint:fix    # 自動修正
pnpm format      # Prettier整形
```
