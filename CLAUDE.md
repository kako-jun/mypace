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

詳細は [docs/architecture.md](./docs/architecture.md) を参照。

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

詳細は [docs/ui-design.md](./docs/ui-design.md) を参照。

## Nostr Events

| kind | 用途 |
|------|------|
| 0 | プロフィール |
| 1 | 投稿（#mypaceタグ付き） |
| 5 | 削除リクエスト |
| 6 | リポスト（NIP-18） |
| 7 | リアクション/いいね（NIP-25） |
| 27235 | HTTP認証（NIP-98） |

詳細は [docs/nostr.md](./docs/nostr.md) を参照。

## Development

- pre-commit hookでlint-staged自動実行
- ESLint + Prettier（セミコロンなし、シングルクォート）
- HonoXはhono/jsx使用（ReactではないためuseMemo等なし）
- Islandsのみがクライアントでhydrate

詳細は [docs/development.md](./docs/development.md) を参照。
