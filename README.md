# MY PACE

**マイペースでいいミディアムレアSNS**

Nostrプロトコル上で動作する、プログラマー向けミディアムレアSNS。

## コンセプト

一般的なSNS（Twitter/X、Bluesky等）との差別化ポイント:

- **Markdownネイティブ**: 投稿は全てMarkdownとしてパース
- **シンタックスハイライト**: コードブロックはPrism.jsでカラーリング
- **パーソナルカラー**: FF7風の4隅グラデーションで自分だけの色を設定
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

### パーソナルカラー (Window Color)

PS1 FF7のウィンドウカラーカスタマイズにインスパイアされた機能:

- **4隅のカラーピッカー**: 画面の四隅の色を自由に設定
- **グラデーション背景**: 4色が中央でなめらかにブレンド
- **投稿カードにも反映**: 設定した色は自分の投稿カードの背景色にもなる
- **他ユーザーにも見える**: タイムラインで各投稿者の個性が一目でわかる
- **自動テキスト色調整**: 背景の明暗に応じてロゴ・テキストが白/黒に切り替わる

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
