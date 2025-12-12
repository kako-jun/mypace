# mypace

Vite + React SPA + Hono API + Cloudflare のマイクロブログサービス。

## Quick Reference

```bash
pnpm install       # 依存関係インストール
pnpm dev           # フロントエンド開発サーバー (localhost:5173)
pnpm dev:api       # API開発サーバー (localhost:8787)
pnpm build         # ビルド
pnpm deploy        # デプロイ（web + api）
pnpm lint          # ESLintチェック
pnpm lint:fix      # ESLint自動修正
pnpm format        # Prettier整形
pnpm typecheck     # TypeScript型チェック
```

## Architecture

- **Frontend**: Vite + React 19 SPA
- **API**: Hono on Cloudflare Workers
- **Database**: Cloudflare D1 (cache)
- **Styling**: Tailwind CSS
- **Auth**: Auto-generated keys (localStorage) + NIP-07

詳細は [docs/architecture.md](./docs/architecture.md) を参照。

## Project Structure

```
apps/
  web/             # React SPA (Cloudflare Pages)
    src/
      components/  # UIコンポーネント
      hooks/       # カスタムフック
      lib/         # ユーティリティ・API通信
      pages/       # ルートコンポーネント
      types/       # 型定義
  api/             # Hono API (Cloudflare Workers)
    src/
      index.ts     # APIエンドポイント
```

## Data Flow

- **読み取り**: Frontend → API → Nostr Relays (SOCKS5対応)
- **書き込み**: Frontend (署名) → API → Nostr Relays

フロントエンドは直接リレーに接続せず、API経由で通信。
署名はクライアント側で行い、署名済みイベントをAPIに送信。

## Features

- 投稿・閲覧（mypaceタグ付き投稿のみ表示）
- プロフィール設定（名前必須、アバター画像）
- 投稿の編集・削除
- 画像アップロード（nostr.build、NIP-98認証）
- 画像クリックでLightBox表示
- いいね・返信・リポスト
- NIP-07対応（ブラウザ拡張）
- 鍵のエクスポート・インポート
- ハッシュタグフィルタリング（複数タグAND/OR）
- キーワード検索（/search）
- ライト/ダークテーマ
- 長文モード（CodeMirror、Vimモード）
- 下書き自動保存
- 短文エディタの最小化（アバターのみ表示）
- タイムライン無限スクロール（過去の投稿読み込み）
- ギャップ検出（取りこぼし投稿の読み込み）
- OGPリンクプレビュー（外部URLのタイトル・画像取得）
- アバター画像エラー時の404表示
- カードホバー時のdrop-shadow効果
- ロゴの星アニメーション（30秒毎に回転）

## Nostr Events

| kind | 用途 |
|------|------|
| 0 | プロフィール |
| 1 | 投稿（#mypaceタグ付き） |
| 5 | 削除リクエスト |
| 6 | リポスト（NIP-18） |
| 7 | リアクション/いいね（NIP-25） |
| 27235 | HTTP認証（NIP-98） |

## Development

- pnpmモノレポ構成
- pre-commit hookでlint-staged自動実行
- ESLint + Prettier（セミコロンなし、シングルクォート）
- React 19 + react-router-dom v7
