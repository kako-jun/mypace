# mypace

HonoX + Cloudflare Pages + Nostr のマイクロブログサービス。

## Quick Reference

```bash
npm run dev      # 開発サーバー (localhost:5173)
npm run build    # ビルド
npm run preview  # Cloudflareローカルプレビュー
npm run deploy   # デプロイ
```

## Architecture

- **Frontend**: HonoX (Islands Architecture)
- **Backend**: Cloudflare Pages Functions
- **Database**: Cloudflare D1 (cache)
- **Auth**: Auto-generated keys (localStorage) + NIP-07

詳細は [docs/](./docs/) を参照。

## Features

- 投稿・閲覧（mypaceタグ付き投稿のみ表示）
- プロフィール設定（名前必須）
- 投稿の編集・削除
- NIP-07対応（ブラウザ拡張）
- 鍵のエクスポート・インポート
- コンテンツパース（ハッシュタグ、URL、画像）
- ハッシュタグフィルタリング（日本語対応）

## Key Files

| Path | Description |
|------|-------------|
| `app/routes/index.tsx` | トップページ |
| `app/routes/api/timeline.ts` | タイムラインAPI |
| `app/islands/PostForm.tsx` | 投稿フォーム |
| `app/islands/Timeline.tsx` | タイムライン表示 |
| `app/islands/Settings.tsx` | 設定パネル |
| `app/islands/ProfileSetup.tsx` | プロフィール設定 |
| `app/islands/Logo.tsx` | ロゴ（クリックでリロード） |
| `app/lib/content-parser.tsx` | コンテンツパーサー |
| `app/lib/nostr/events.ts` | Nostrイベント生成 |
| `app/lib/nostr/relay.ts` | リレー通信 |
| `app/lib/nostr/keys.ts` | 鍵管理 |
| `app/lib/db/cache.ts` | D1キャッシュ層 |
| `wrangler.toml` | Cloudflare設定 |
| `schema.sql` | D1スキーマ |

## Nostr Events

| kind | 用途 |
|------|------|
| 0 | プロフィール（name, display_name） |
| 1 | 投稿（#mypaceタグ付き） |
| 5 | 削除リクエスト |
