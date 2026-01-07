# Dynamic OGP

投稿ページ・ユーザーページの動的OGP生成機能。

## 現状

**動作確認済み**。クローラーがアクセスすると動的OGPが返される。

## 実装

### Cloudflare Pages Functions

`apps/web/functions/` にFunctionsを配置：

```
functions/
  lib/ogp-template.ts  # HTML生成
  post/[id].ts         # 投稿ページOGP
  user/[npub].ts       # ユーザーページOGP
  package.json         # nostr-tools依存関係
```

### クローラー検出パターン

```typescript
/bot|crawler|spider|slurp|archiver|facebookexternalhit|twitterbot|linkedinbot|whatsapp|slack|discord|telegram|line|skype|viber|kakao|preview|fetch|embed|card|link|meta|curl|wget|http|url/i
```

## Cloudflare設定

### ビルドコマンド

```
pnpm install && pnpm -C apps/web build && cp -r apps/web/functions . && npm install --prefix functions
```

### wrangler.toml

プロジェクトルートに `wrangler.toml` を追加：

```toml
name = "mypace"
compatibility_date = "2024-01-01"
pages_build_output_dir = "apps/web/dist"
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

## 動作の流れ

1. クローラーが `/post/{id}` にアクセス
2. `_routes.json` の `include` にマッチ → Functionsが実行される
3. `functions/post/[id].ts` がUser-Agentをチェック
4. クローラーなら動的OGPを生成して返す
5. クローラーでなければ `context.next()` → SPAのindex.htmlが返る

## ローカルテスト

```bash
# ビルド
cd apps/web && pnpm build

# functionsをルートにコピー（Cloudflareビルド時と同じ構成）
cd ../..
cp -r apps/web/functions .
cd functions && npm install && cd ..

# wranglerで起動
npx wrangler pages dev apps/web/dist

# クローラーとしてテスト
curl -A "curl/test" "http://localhost:8788/post/{EVENT_ID}"
```

## 関連

- [seo.md](../seo.md) - SEO全体の設計
- [share.md](./share.md) - シェアメニュー
