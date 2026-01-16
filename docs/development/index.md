# 開発者向けドキュメント

MY PACEの技術ドキュメントです。

## セットアップ

- [はじめに](./getting-started.md) - 開発環境のセットアップ、プロジェクト構造

## アーキテクチャ

- [アーキテクチャ](./architecture.md) - システム構成図、データフロー
- [Nostr統合](./nostr.md) - 認証、イベント、NIP対応
- [API通信最適化](./api-optimization.md) - バッチ処理によるリクエスト削減

## デプロイ・運用

- [デプロイ](./deploy.md) - Cloudflare Pages / Workers へのデプロイ
- [SEO](./seo.md) - 動的OGP、robots.txt、sitemap

## UI/UX

- [UIデザイン](./ui-design.md) - デザインガイドライン

## 拡張仕様

- [拡張仕様](./extensions/) - MY PACE独自タグ・API仕様

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

[← ユーザーガイドに戻る](../user-guide/)
