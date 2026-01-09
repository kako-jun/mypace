# MY PACE - 開発者向けドキュメント

> このドキュメントは、MY PACEの全体像を把握するための目次です。
> 詳細なドキュメントは[docs/](./docs/)ディレクトリに配置されています。

---

## ドキュメント目次

### ユーザー向けドキュメント

- **[ユーザーガイド](./docs/user-guide/index.md)** - MY PACEの使い方
  - [クイックスタート](./docs/user-guide/quick-start.md)
  - [基本操作](./docs/user-guide/basics/index.md) - タイムライン、投稿、リアクション
  - [便利な機能](./docs/user-guide/features/index.md) - フィルター、ミュート、共有
  - [クリエイティブ機能](./docs/user-guide/creative/index.md) - お絵かき、ボイスメモ、ステッカー
  - [カスタマイズ](./docs/user-guide/customize/index.md) - プロフィール、設定
  - [上級者向け](./docs/user-guide/advanced/index.md) - 鍵の管理、NIP-07
  - [FAQ](./docs/user-guide/faq.md)

### 開発者向けドキュメント

- **[開発者向けドキュメント](./docs/development/index.md)** - 技術仕様と開発ガイド
  - [開発環境](./docs/development/getting-started.md) - セットアップ、プロジェクト構成
  - [アーキテクチャ](./docs/development/architecture.md) - システム構成、データフロー
  - [Nostr統合](./docs/development/nostr.md) - 認証、イベント、NIP対応
  - [デプロイ](./docs/development/deploy.md) - Cloudflare Pages / Workers
  - [SEO](./docs/development/seo.md) - 動的OGP、sitemap
  - [UIデザイン](./docs/development/ui-design.md) - デザインガイドライン
  - [拡張仕様](./docs/development/extensions/index.md) - 独自タグ・API仕様

---

## クイックリファレンス

```bash
pnpm install       # 依存関係インストール
pnpm dev           # フロントエンド開発サーバー (localhost:5173)
pnpm dev:api       # API開発サーバー (localhost:8787)
pnpm build         # ビルド
pnpm deploy        # デプロイ（web + api）
pnpm lint          # ESLintチェック
pnpm typecheck     # TypeScript型チェック
```

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Vite + React 19 SPA |
| API | Hono on Cloudflare Workers |
| データベース | Cloudflare D1 (cache) |
| スタイリング | Tailwind CSS |
| プロトコル | Nostr (NIP-01, NIP-07, NIP-25, etc.) |

---

## プロジェクト構成

```
apps/
  web/             # React SPA (Cloudflare Pages)
  api/             # Hono API (Cloudflare Workers)
docs/
  user-guide/      # ユーザー向けドキュメント
  development/     # 開発者向けドキュメント
```
