# Development

## Prerequisites

- Node.js 20+
- pnpm 9+

## Setup

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev        # Frontend (localhost:5173)
pnpm dev:api    # API (localhost:8787)
```

## Project Structure

```
mypace/
├── packages/
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

## Adding New Pages (React Router)

`packages/web/src/App.tsx` にルートを追加:

```typescript
import { NewPage } from './pages/NewPage'

<Route path="/new" element={<NewPage />} />
```

## Adding New API Endpoints

`packages/api/src/index.ts` にエンドポイントを追加:

```typescript
app.get('/api/new-endpoint', async (c) => {
  const db = c.env.DB
  // ...
  return c.json({ data: 'value' })
})
```

## API Client

フロントエンドからAPIを呼び出す場合は `lib/api.ts` を使用:

```typescript
import { fetchTimeline, publishEvent } from '../lib/api'

// タイムライン取得
const { events, source } = await fetchTimeline(50)

// イベント投稿（署名済み）
await publishEvent(signedEvent)
```

## Nostr Event Signing

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

## Environment Variables

### Frontend (packages/web)

`.env` ファイル:

```env
VITE_API_URL=http://localhost:8787
```

### API (packages/api)

`wrangler.toml`:

```toml
[vars]
SOCKS5_PROXY = "socks5://localhost:1080"  # Optional
```

## TypeScript

- **Frontend**: React + DOM types
- **API**: Cloudflare Workers types
- 型定義は各パッケージの `types/` または `src/types/` に配置

## Code Style

- ESLint + Prettier
- セミコロンなし
- シングルクォート
- pre-commit hook で自動整形

```bash
pnpm lint        # チェック
pnpm lint:fix    # 自動修正
pnpm format      # Prettier整形
```
