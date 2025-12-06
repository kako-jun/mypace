# MYPACE

**プログラマーのためのマイクロブログ**

Nostrプロトコル上で動作する、開発者に特化したマイクロブログサービス。

## コンセプト

一般的なマイクロブログ（Twitter/X、Bluesky等）との差別化ポイント:

- **Markdownネイティブ**: 投稿は全てMarkdownとしてパース
- **シンタックスハイライト**: コードブロックはPrism.jsでカラーリング
- **分散型**: Nostrプロトコルにより、特定のサーバーに依存しない
- **プライバシー重視**: 秘密鍵はローカルのみに保存

## 特徴

### Markdown & コードハイライト

```typescript
// コードブロックは言語を指定すると
// VS Code風のダークテーマでハイライト
const greeting = "Hello, World!";
console.log(greeting);
```

対応言語: TypeScript, JavaScript, Python, Rust, Go, CSS, JSON, YAML, Bash, SQL等

### インラインコード

`npm install` のようなインラインコードもスタイリング。

### ハッシュタグフィルタリング

- 日本語ハッシュタグ対応 (#開発日記 など)
- クリックで同じタグの投稿を絞り込み
- mypaceタグ付き投稿のみ表示（Nostr全体ではなく）

### 投稿管理

- 編集・削除機能（インライン確認UI）
- プロフィール名変更
- 操作成功時のフィードバックメッセージ

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | HonoX (Islands Architecture) |
| ホスティング | Cloudflare Pages |
| プロトコル | Nostr (NIP-01, NIP-07) |
| データ | Nostr公開リレー + D1キャッシュ |
| Markdownパーサー | Marked |
| コードハイライト | Prism.js |

## 開発

```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build

# Cloudflare Pagesへデプロイ
npm run deploy
```

## ドキュメント

- [UIデザイン](docs/ui-design.md) - デザイン哲学とスタイルガイド
- [アーキテクチャ](docs/architecture.md) - システム構成
- [Nostr](docs/nostr.md) - Nostrプロトコル実装詳細
- [デプロイ](docs/deploy.md) - Cloudflare Pagesへのデプロイ手順
- [開発](docs/development.md) - ローカル開発環境

## ライセンス

MIT
