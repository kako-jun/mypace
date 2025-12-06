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

## Key Files

| Path | Description |
|------|-------------|
| `app/routes/index.tsx` | トップページ |
| `app/routes/api/timeline.ts` | タイムラインAPI |
| `app/islands/` | クライアントコンポーネント |
| `app/lib/nostr/` | Nostr関連ユーティリティ |
| `app/lib/db/cache.ts` | D1キャッシュ層 |
| `wrangler.toml` | Cloudflare設定 |
| `schema.sql` | D1スキーマ |
