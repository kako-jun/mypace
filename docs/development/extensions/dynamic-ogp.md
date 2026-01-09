# Dynamic OGP

投稿ページ・ユーザーページの動的OGP生成機能。

## 現状

**動作確認済み**。すべてのリクエストで動的OGPが返される。

## 仕組み

すべてのリクエストに対して、OGPメタタグを動的に置換したHTMLを返す：

1. Functionsがリクエストを受け取る
2. APIからプロフィール/投稿データを取得
3. ビルド済み`index.html`を読み込む（`context.env.ASSETS.fetch()`）
4. OGPメタタグ部分を正規表現で置換
5. 置換後のHTMLを返す

**ポイント:**
- User-Agent判定は不要（クローラーもブラウザも同じHTMLを受け取る）
- クローラーは`<head>`内のOGPメタタグを読み取る
- ブラウザはJavaScriptを実行してSPAとして動作

## 実装

### Cloudflare Pages Functions

`apps/web/functions/` にFunctionsを配置：

```
functions/
  post/[id].ts         # 投稿ページOGP
  user/[npub].ts       # ユーザーページOGP
  package.json         # nostr-tools依存関係
  tsconfig.json
```

### _routes.json

`apps/web/public/_routes.json` でFunctionsルートを指定：

```json
{
  "version": 1,
  "include": [
    "/post/*",
    "/user/*"
  ],
  "exclude": []
}
```

**重要**: `include`に指定したパスでのみFunctionsが実行される。

### _redirects

`apps/web/public/_redirects` にはSPAフォールバックを**書かない**：

```
# SPA fallback is handled by _routes.json and functions
# Do not add /* /index.html 200 here as it breaks Functions
```

**理由**: `/* /index.html 200` があると、Functionsより先にSPAフォールバックが適用されてしまう。

## デプロイ

```bash
cd apps/web
pnpm build
npx wrangler pages deploy dist
```

## ローカルテスト

```bash
cd apps/web
pnpm build
pnpm preview  # または npx wrangler pages dev dist

# テスト
curl "http://localhost:8788/user/{NPUB}"
curl "http://localhost:8788/post/{EVENT_ID}"
```

## 関連

- [seo.md](../seo.md) - SEO全体の設計
- [共有（ユーザーガイド）](../../user-guide/features/share.md) - シェアメニュー
